/**
 * Context menu integration for editor and file-explorer actions.
 */

import type { VaultActionManager } from "@textfresser/vault-action-manager";
import type { App, Menu, Plugin } from "obsidian";
import { z } from "zod";
import { wouldSplitToMultiplePages as checkWouldSplit } from "../../../commanders/librarian/bookkeeper/split-to-pages-action";
import { makeCodecRulesFromSettings } from "../../../commanders/librarian/codecs/rules";
import { getParsedUserSettings } from "../../../global-state/global-state";
import { noteMetadataHelper } from "../../../stateless-helpers/note-metadata";
import {
	FileType,
	MdFileSubTypeSchema,
} from "../../../types/common-interface/enums";
import {
	type CommandExecutor,
	CommandKind,
} from "../../obsidian/command-executor";

/** Schema for reading noteKind from file metadata. */
const FileTypeMetadataSchema = z.object({
	noteKind: MdFileSubTypeSchema.optional(),
});

export type ContextMenuDeps = {
	app: App;
	plugin: Plugin;
	commandExecutor: CommandExecutor | null;
	vam: VaultActionManager;
};

/**
 * Setup context menu for "Split into pages" action.
 * Returns teardown function for cleanup.
 */
export function setupContextMenu(deps: ContextMenuDeps): () => void {
	const { app, commandExecutor, plugin, vam } = deps;

	const editorMenuRef = app.workspace.on("editor-menu", (menu: Menu) => {
		handleEditorMenu(menu, vam, commandExecutor);
	});

	plugin.registerEvent(editorMenuRef);

	// Return teardown (Obsidian handles unregistration via registerEvent)
	return () => {
		app.workspace.offref(editorMenuRef);
	};
}

/**
 * Handle editor menu event synchronously.
 * Uses vam.getOpenedContent() for content access.
 */
function handleEditorMenu(
	menu: Menu,
	vam: VaultActionManager,
	commandExecutor: CommandExecutor | null,
): void {
	const splitPath = vam.mdPwd();
	if (!splitPath) return;

	// Check if in library
	let isInLibrary = false;
	try {
		const { splitPathToLibraryRoot } = getParsedUserSettings();
		const libraryPathParts = splitPathToLibraryRoot.pathParts;
		// Check if splitPath starts with library path parts
		isInLibrary =
			splitPath.pathParts.length >= libraryPathParts.length &&
			libraryPathParts.every(
				(part, i) => splitPath.pathParts[i] === part,
			);
	} catch {
		isInLibrary = false;
	}

	if (!isInLibrary) return;

	// Get file content from VAM
	const contentResult = vam.getOpenedContent();
	if (contentResult.isErr()) return;

	const content = contentResult.value;

	// Read file metadata to determine type
	let fileType: FileType | null = null;
	let wouldSplitToMultiplePages = false;

	try {
		const metaInfo = noteMetadataHelper.read(
			content,
			FileTypeMetadataSchema,
		);
		fileType = metaInfo?.noteKind ?? null;

		// Check if scroll would split to multiple pages
		if (fileType === FileType.Scroll || fileType === null) {
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

	// Show "Split into pages" when: in library AND (Scroll OR untyped) AND would split
	const shouldShow =
		isInLibrary &&
		wouldSplitToMultiplePages &&
		(fileType === null || fileType === FileType.Scroll);

	if (shouldShow) {
		menu.addItem((item) =>
			item
				.setTitle("Split into pages")
				.setIcon("split")
				.onClick(() => {
					if (!commandExecutor) return;
					void commandExecutor(CommandKind.SplitToPages);
				}),
		);
	}
}
