import { type App, MarkdownView } from "obsidian";
import { z } from "zod";
import {
	getNextPageSplitPath,
	getPrevPageSplitPath,
} from "../../../../commanders/librarian/bookkeeper/page-codec";
import { wouldSplitToMultiplePages as checkWouldSplit } from "../../../../commanders/librarian/bookkeeper/segmenter";
import { makeCodecRulesFromSettings } from "../../../../commanders/librarian/codecs/rules";
import { getParsedUserSettings } from "../../../../global-state/global-state";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
} from "../../../../managers/obsidian/vault-action-manager";
import { readMetadata } from "../../../../managers/pure/note-metadata-manager";
import {
	FileType,
	MdFileSubTypeSchema,
} from "../../../../types/common-interface/enums";
import type { OverlayContext } from "../types";

// Schema for reading noteKind from metadata
const FileTypeMetadataSchema = z.object({
	noteKind: MdFileSubTypeSchema.optional(),
});

/**
 * Dependencies for ContextBuilder.
 */
export type ContextBuilderDeps = {
	app: App;
};

/**
 * Find MarkdownView for a specific file path by iterating all markdown leaves.
 */
function getMarkdownViewForFile(
	app: App,
	filePath: string,
): MarkdownView | null {
	const leaves = app.workspace.getLeavesOfType("markdown");
	for (const leaf of leaves) {
		const view = leaf.view;
		if (view instanceof MarkdownView && view.file?.path === filePath) {
			return view;
		}
	}
	return null;
}

/**
 * Check if there's an active text selection in the editor.
 */
function hasActiveSelection(view: MarkdownView | null): boolean {
	if (!view) return false;
	const editor = view.editor;
	if (!editor) return false;
	const selection = editor.getSelection();
	return selection.length > 0;
}

/**
 * Core context building logic - builds OverlayContext from view and file.
 */
async function buildContextCore(
	app: App,
	view: MarkdownView | null,
): Promise<OverlayContext> {
	const file = view?.file;

	let path: OverlayContext["path"] = null;
	let fileType: FileType | null = null;
	let isInLibrary = false;
	let wouldSplitToMultiplePages = false;
	let pageIndex: number | null = null;
	let hasNextPage = false;
	let hasPrevPage = false;

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
			isInLibrary = false;
		}

		// Detect Page by filename pattern FIRST (before metadata read)
		const pageMatch =
			splitPath.kind === "MdFile"
				? splitPath.basename.match(/_Page_(\d{3})/)
				: null;

		if (pageMatch?.[1] && splitPath.kind === "MdFile") {
			fileType = FileType.Page;
			pageIndex = Number.parseInt(pageMatch[1], 10);

			// Check if next page exists
			const nextPath = getNextPageSplitPath(splitPath);
			if (nextPath) {
				const systemPath = makeSystemPathForSplitPath(nextPath);
				hasNextPage =
					app.vault.getAbstractFileByPath(systemPath) !== null;
			}

			// Check if prev page exists
			if (pageIndex > 0) {
				const prevPath = getPrevPageSplitPath(splitPath);
				if (prevPath) {
					const systemPath = makeSystemPathForSplitPath(prevPath);
					hasPrevPage =
						app.vault.getAbstractFileByPath(systemPath) !== null;
				}
			}
		} else if (isInLibrary) {
			// For non-page files, read metadata to determine type
			try {
				const content = await app.vault.read(file);
				const metaInfo = readMetadata(content, FileTypeMetadataSchema);
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
			} catch {
				fileType = null;
			}
		}
	}

	// Check for text selection
	const hasSelection = hasActiveSelection(view);

	// Check mobile
	// biome-ignore lint/suspicious/noExplicitAny: <isMobile is not in official types but exists>
	const isMobile = (app as any).isMobile ?? false;

	// Check source mode
	const isSourceMode = view?.getMode() === "source";

	// Get viewport width
	const viewportWidth = window.innerWidth;

	return {
		fileType,
		hasNextPage,
		hasPrevPage,
		hasSelection,
		isInLibrary,
		isMobile,
		isSourceMode,
		pageIndex,
		path,
		viewportWidth,
		wouldSplitToMultiplePages,
	};
}

/**
 * Build OverlayContext from current app state.
 * Uses getActiveViewOfType to find the current view.
 */
export async function buildOverlayContext(
	deps: ContextBuilderDeps,
): Promise<OverlayContext> {
	const view = deps.app.workspace.getActiveViewOfType(MarkdownView);
	return buildContextCore(deps.app, view);
}

/**
 * Build OverlayContext for a specific file path.
 * Falls back to finding view by file path if getActiveViewOfType returns null.
 */
export async function buildOverlayContextForFile(
	deps: ContextBuilderDeps,
	filePath: string,
): Promise<OverlayContext> {
	// Try getActiveViewOfType first
	let view = deps.app.workspace.getActiveViewOfType(MarkdownView);

	// Fallback: find view by file path
	if (!view) {
		view = getMarkdownViewForFile(deps.app, filePath);
	}

	return buildContextCore(deps.app, view);
}

/**
 * Export helper for finding view by file path (used by other modules).
 */
export { getMarkdownViewForFile };
