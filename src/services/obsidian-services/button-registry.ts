import { type App, MarkdownView } from "obsidian";
import { getParsedUserSettings } from "../../global-state/global-state";
import { makeSplitPath } from "../../managers/obsidian/vault-action-manager";
import type { AnySplitPath } from "../../managers/obsidian/vault-action-manager/types/split-path";
import { extractMetaInfoDeprecated } from "../../managers/pure/meta-info-manager-deprecated/interface";
import type { FileType } from "../../types/common-interface/enums";
import { ACTION_CONFIGS } from "../wip-configs/actions/actions-config";
import {
	ALL_USER_ACTIONS,
	type AnyActionConfig,
	type ButtonContext,
	UserActionPlacement,
} from "../wip-configs/actions/types";

type ActionSubscriber = (actions: AnyActionConfig[]) => void;

/**
 * Central registry that computes available actions based on context.
 * Services subscribe to receive action updates for their placement.
 */
export class ButtonRegistry {
	private bottomSubscribers: ActionSubscriber[] = [];
	private selectionSubscribers: ActionSubscriber[] = [];
	private currentContext: ButtonContext | null = null;

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
					const metaInfo = extractMetaInfoDeprecated(content);
					fileType = metaInfo?.fileType ?? null;
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
			hasSelection,
			isInLibrary,
			isMobile,
			path,
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
	 * Filter actions by predicate and placement.
	 */
	private filterActions(
		ctx: ButtonContext,
		placement: (typeof UserActionPlacement)[keyof typeof UserActionPlacement],
	): AnyActionConfig[] {
		return ALL_USER_ACTIONS.filter((action) => {
			const config = ACTION_CONFIGS[action];
			return config.placement === placement && config.isAvailable(ctx);
		})
			.map((action) => ACTION_CONFIGS[action])
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
