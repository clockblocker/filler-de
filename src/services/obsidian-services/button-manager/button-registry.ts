import { type App, MarkdownView } from "obsidian";
import { z } from "zod";
import { getNextPageSplitPath } from "../../../commanders/librarian/bookkeeper/page-codec";
import { wouldSplitToMultiplePages as checkWouldSplit } from "../../../commanders/librarian/bookkeeper/segmenter";
import { makeCodecRulesFromSettings } from "../../../commanders/librarian/codecs/rules";
import { getParsedUserSettings } from "../../../global-state/global-state";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
} from "../../../managers/obsidian/vault-action-manager";
import type { AnySplitPath } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { readMetadata } from "../../../managers/pure/note-metadata-manager";
import {
	FileType,
	MdFileSubTypeSchema,
} from "../../../types/common-interface/enums";
import { ACTION_CONFIGS } from "../../wip-configs/actions/actions-config";

// Schema for reading noteKind from metadata
const FileTypeMetadataSchema = z.object({
	noteKind: MdFileSubTypeSchema.optional(),
});

import {
	ALL_USER_ACTIONS,
	type AnyActionConfig,
	type ButtonContext,
	type RenderedActionConfig,
	UserActionPlacement,
} from "../../wip-configs/actions/types";

type ActionSubscriber = (actions: RenderedActionConfig[]) => void;

/**
 * Central registry that computes available actions based on context.
 * Services subscribe to receive action updates for their placement.
 */
export class ButtonRegistry {
	private static readonly DEBOUNCE_MS = 50;
	private bottomSubscribers: ActionSubscriber[] = [];
	private selectionSubscribers: ActionSubscriber[] = [];
	private currentContext: ButtonContext | null = null;
	private recomputeTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor(private app: App) {}

	/**
	 * Build context from current app state.
	 */
	private async buildContext(): Promise<ButtonContext> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		const file = view?.file;

		let path: AnySplitPath | null = null;
		let fileType: FileType | null = null;
		let isInLibrary = false;
		let wouldSplitToMultiplePages = false;
		let pageIndex: number | null = null;
		let hasNextPage = false;

		if (file) {
			const splitPath = makeSplitPath(file.path);
			path = splitPath;

			// Check if inside library
			try {
				const { splitPathToLibraryRoot } = getParsedUserSettings();
				const libraryPath = splitPathToLibraryRoot.pathParts.join("/");
				isInLibrary =
					file.path.startsWith(`${libraryPath}/`) ||
					file.path.startsWith(libraryPath);
			} catch {
				// Settings not initialized yet
				isInLibrary = false;
			}

			// Get file type from metadata
			if (isInLibrary) {
				try {
					const content = await this.app.vault.read(file);
					const metaInfo = readMetadata(
						content,
						FileTypeMetadataSchema,
					);
					fileType = metaInfo?.noteKind ?? null;

					// Check if scroll would split to multiple pages
					if (fileType === FileType.Scroll) {
						const settings = getParsedUserSettings();
						const rules = makeCodecRulesFromSettings(settings);
						wouldSplitToMultiplePages = checkWouldSplit(
							content,
							splitPath.basename,
							rules,
						);
					}

					// Extract page index for Page files
					if (
						fileType === FileType.Page &&
						splitPath.kind === "MdFile"
					) {
						const match = splitPath.basename.match(/_Page_(\d{3})/);
						if (match?.[1]) {
							pageIndex = Number.parseInt(match[1], 10);
						}
						// Check if next page exists
						const nextPath = getNextPageSplitPath(splitPath);
						if (nextPath) {
							const systemPath =
								makeSystemPathForSplitPath(nextPath);
							hasNextPage =
								this.app.vault.getAbstractFileByPath(
									systemPath,
								) !== null;
						}
					}
				} catch {
					fileType = null;
				}
			}
		}

		// Check for text selection
		const hasSelection = this.hasActiveSelection(view);

		// Check mobile
		// biome-ignore lint/suspicious/noExplicitAny: <isMobile is not in official types but exists>
		const isMobile = (this.app as any).isMobile ?? false;

		return {
			fileType,
			hasNextPage,
			hasSelection,
			isInLibrary,
			isMobile,
			pageIndex,
			path,
			wouldSplitToMultiplePages,
		};
	}

	/**
	 * Check if there's an active text selection in the editor.
	 */
	private hasActiveSelection(view: MarkdownView | null): boolean {
		if (!view) return false;

		const editor = view.editor;
		if (!editor) return false;

		const selection = editor.getSelection();
		return selection.length > 0;
	}

	/**
	 * Filter actions by predicate and placement, computing disabled state.
	 */
	private filterActions(
		ctx: ButtonContext,
		placement: (typeof UserActionPlacement)[keyof typeof UserActionPlacement],
	): RenderedActionConfig[] {
		return ALL_USER_ACTIONS.filter((action) => {
			const config = ACTION_CONFIGS[action];
			return config.placement === placement && config.isAvailable(ctx);
		})
			.map((action) => {
				const config: AnyActionConfig = ACTION_CONFIGS[action];
				const disabled = config.isEnabled
					? !config.isEnabled(ctx)
					: false;
				return { ...config, disabled };
			})
			.sort((a, b) => a.priority - b.priority);
	}

	/**
	 * Recompute available actions and notify subscribers.
	 */
	public async recompute(): Promise<void> {
		const ctx = await this.buildContext();
		this.currentContext = ctx;

		const bottomActions = this.filterActions(
			ctx,
			UserActionPlacement.Bottom,
		);
		const selectionActions = this.filterActions(
			ctx,
			UserActionPlacement.AboveSelection,
		);

		for (const fn of this.bottomSubscribers) {
			fn(bottomActions);
		}
		for (const fn of this.selectionSubscribers) {
			fn(selectionActions);
		}
	}

	/**
	 * Schedule a debounced recompute. Useful for handling rapid events.
	 */
	public scheduleRecompute(): void {
		if (this.recomputeTimeout) clearTimeout(this.recomputeTimeout);
		this.recomputeTimeout = setTimeout(() => {
			this.recomputeTimeout = null;
			void this.recompute();
		}, ButtonRegistry.DEBOUNCE_MS);
	}

	/**
	 * Subscribe to bottom toolbar action changes.
	 */
	public subscribeBottom(fn: ActionSubscriber): void {
		this.bottomSubscribers.push(fn);
	}

	/**
	 * Subscribe to selection toolbar action changes.
	 */
	public subscribeSelection(fn: ActionSubscriber): void {
		this.selectionSubscribers.push(fn);
	}

	/**
	 * Get current context (for external use).
	 */
	public getContext(): ButtonContext | null {
		return this.currentContext;
	}
}
