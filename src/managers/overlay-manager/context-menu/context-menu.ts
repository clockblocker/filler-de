/**
 * Context menu integration for "Split into pages" action.
 *
 * Shows menu item when:
 * - File is in library
 * - File is Scroll OR untyped
 * - Scroll would split to multiple pages
 */

import { type App, MarkdownView, type Menu, type Plugin } from "obsidian";
import { z } from "zod";
import { wouldSplitToMultiplePages as checkWouldSplit } from "../../../commanders/librarian/bookkeeper/segmenter";
import { makeCodecRulesFromSettings } from "../../../commanders/librarian/codecs/rules";
import { getParsedUserSettings } from "../../../global-state/global-state";
import { readMetadata } from "../../../stateless-services/note-metadata-manager";
import {
	FileType,
	MdFileSubTypeSchema,
} from "../../../types/common-interface/enums";
import type { CommandExecutor } from "../../actions-manager/create-action-executor";
import { CommandKind } from "../../actions-manager/types";
import { makeSplitPath } from "../../obsidian/vault-action-manager";

/** Schema for reading noteKind from file metadata. */
const FileTypeMetadataSchema = z.object({
	noteKind: MdFileSubTypeSchema.optional(),
});

export type ContextMenuDeps = {
	app: App;
	plugin: Plugin;
	commandExecutor: CommandExecutor | null;
};

/**
 * Setup context menu for "Split into pages" action.
 * Returns teardown function for cleanup.
 */
export function setupContextMenu(deps: ContextMenuDeps): () => void {
	const { app, plugin, commandExecutor } = deps;

	const eventRef = app.workspace.on("editor-menu", (menu: Menu) => {
		handleEditorMenu(menu, app, commandExecutor);
	});

	plugin.registerEvent(eventRef);

	// Return teardown (Obsidian handles unregistration via registerEvent)
	return () => {
		app.workspace.offref(eventRef);
	};
}

/**
 * Handle editor menu event synchronously.
 * Uses editor.getValue() for synchronous content access.
 */
function handleEditorMenu(
	menu: Menu,
	app: App,
	commandExecutor: CommandExecutor | null,
): void {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	const file = view?.file;
	const editor = view?.editor;
	if (!file || !editor) return;

	// Check if in library
	let isInLibrary = false;
	try {
		const { splitPathToLibraryRoot } = getParsedUserSettings();
		const libraryPath = splitPathToLibraryRoot.pathParts.join("/");
		isInLibrary =
			file.path.startsWith(`${libraryPath}/`) ||
			file.path.startsWith(libraryPath);
	} catch {
		isInLibrary = false;
	}

	if (!isInLibrary) return;

	// Get file content synchronously from editor
	const content = editor.getValue();

	// Read file metadata to determine type
	let fileType: FileType | null = null;
	let wouldSplitToMultiplePages = false;

	try {
		const metaInfo = readMetadata(content, FileTypeMetadataSchema);
		fileType = metaInfo?.noteKind ?? null;

		// Check if scroll would split to multiple pages
		if (fileType === FileType.Scroll || fileType === null) {
			const settings = getParsedUserSettings();
			const rules = makeCodecRulesFromSettings(settings);
			const splitPath = makeSplitPath(file.path);
			wouldSplitToMultiplePages = checkWouldSplit(
				content,
				splitPath.basename,
				rules,
			);
		}
	} catch {
		fileType = null;
	}

	// Show "Split into pages" when: in library AND (Scroll OR untyped) AND would split
	const shouldShow =
		isInLibrary &&
		(fileType === null ||
			(fileType === FileType.Scroll && wouldSplitToMultiplePages));

	if (shouldShow) {
		menu.addItem((item) =>
			item
				.setTitle("Split into pages")
				.setIcon("split")
				.onClick(() => {
					if (!commandExecutor) return;
					void commandExecutor({
						kind: CommandKind.MakeText,
						payload: {},
					});
				}),
		);
	}
}
