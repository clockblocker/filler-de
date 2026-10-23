/**
 * Context menu integration for editor and file-explorer actions.
 */

import { makeCodecRulesFromSettings } from "@textfresser/library-core";
import type {
	SplitPathToMdFile,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect, Exit } from "effect";
import type { App, Menu, Plugin } from "obsidian";
import type { Librarian } from "../../../commanders/librarian/librarian";
import { wouldSplitToMultiplePages as checkWouldSplit } from "../../../commanders/librarian/pages/split-to-pages-action";
import type { ReadSync } from "../../../runtime/plugin-runtime";
import type { ParsedUserSettings } from "../../../settings/parsed-settings";
import {
	LibraryMetadata,
	metadataFormatOf,
	noteMetadataHelper,
} from "../../../stateless-helpers/note-metadata";
import { FileType } from "../../../types/common-interface/enums";
import {
	type CommandExecutor,
	CommandKind,
} from "../../obsidian/command-executor";

type ContextMenuDeps = {
	app: App;
	plugin: Plugin;
	commandExecutor: CommandExecutor | null;
	librarian: Pick<Librarian, "isInsideLibrary">;
	readSync: ReadSync;
	/** The settings in effect, read as the menu opens. */
	settings: () => ParsedUserSettings;
	vam: VaultActionManager;
};

/**
 * Active editor file for the context menu, or null when it is outside the
 * Library. Library membership is the Librarian's call.
 */
export const getContextMenuFile = Effect.fn("getContextMenuFile")(function* (
	vam: Pick<VaultActionManager, "getActiveEditorContext">,
	librarian: Pick<Librarian, "isInsideLibrary">,
) {
	const context = yield* vam.getActiveEditorContext();
	if (!context) return null;
	const { content, splitPath } = context;
	if (!librarian.isInsideLibrary(splitPath)) return null;

	return { content, splitPath };
});

/**
 * Setup context menu for "Split into pages" action.
 * Returns teardown function for cleanup.
 */
export function setupContextMenu(deps: ContextMenuDeps): () => void {
	const { app, commandExecutor, librarian, plugin, readSync, settings, vam } =
		deps;

	const editorMenuRef = app.workspace.on("editor-menu", (menu: Menu) => {
		handleEditorMenu(
			menu,
			readSync(getContextMenuFile(vam, librarian)),
			settings(),
			commandExecutor,
		);
	});

	plugin.registerEvent(editorMenuRef);

	// Return teardown (Obsidian handles unregistration via registerEvent)
	return () => {
		app.workspace.offref(editorMenuRef);
	};
}

/**
 * Handle editor menu event synchronously, for the active Library note read
 * as the menu opens.
 */
function handleEditorMenu(
	menu: Menu,
	activeFileExit: Exit.Exit<
		{ content: string; splitPath: SplitPathToMdFile } | null,
		unknown
	>,
	settings: ParsedUserSettings,
	commandExecutor: CommandExecutor | null,
): void {
	if (Exit.isFailure(activeFileExit) || !activeFileExit.value) return;
	const { content, splitPath } = activeFileExit.value;

	// Read file metadata to determine type
	let fileType: FileType | null = null;
	let wouldSplitToMultiplePages = false;

	try {
		const metaInfo = noteMetadataHelper.read(
			content,
			LibraryMetadata,
			metadataFormatOf(settings),
		);
		fileType = metaInfo?.noteKind ?? null;

		// Check if scroll would split to multiple pages
		if (fileType === FileType.Scroll || fileType === null) {
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
