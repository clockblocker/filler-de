import { Context, type Effect } from "effect";
import type { Editor, TAbstractFile, TFile, TFolder } from "obsidian";
import type { VaultFileStat } from "../types/file-stat";
import type { VamActiveEditorError, VamVaultIoError } from "./errors";

type ActiveEditor = Pick<
	Editor,
	| "getCursor"
	| "getLine"
	| "getSelection"
	| "getValue"
	| "listSelections"
	| "posToOffset"
	| "replaceRange"
	| "replaceSelection"
	| "scrollIntoView"
	| "setSelection"
	| "setLine"
	| "transaction"
>;

export type SavedInlineTitleSelection = {
	readonly end: number;
	readonly start: number;
	readonly text: string;
};

/**
 * Narrow production/test seam captured from one Markdown view lookup: the
 * active view, or any view `markdownViewsOf` lists. Each view has its own
 * `editor`, so the editor object tells two views apart.
 */
export type ActiveEditorHandle = {
	readonly editor: ActiveEditor;
	readonly file: TFile | null;
	readonly mode: string;
	isCurrent(): boolean;
	/**
	 * The view's content in its current mode (`getViewData`). In reading
	 * mode Obsidian updates only the rendered mode, so `editor` can lag it.
	 * Absent: read `editor`.
	 */
	readonly viewData?: () => string;
	/**
	 * What the view last loaded from or saved to disk, from Obsidian's
	 * internal `TextFileView.lastSavedData` and `saving`: `data` is `null`
	 * while the view holds no content yet. A view whose content is `data`,
	 * not mid-save, holds no unsaved typing. `undefined` when Obsidian does
	 * not say.
	 */
	readonly persisted?: () =>
		| { readonly data: string | null; readonly saving: boolean }
		| undefined;
	readInlineTitleSelection(): SavedInlineTitleSelection | null;
	restoreInlineTitleSelection(saved: SavedInlineTitleSelection): void;
};

export type ActiveEditorReadiness = "editor" | "inline-title";

/**
 * Obsidian's "Automatically update internal links" setting
 * (`alwaysUpdateLinks`). `FileManager.renameFile` honours it after the move:
 * `always` rewrites the links at once; `ask` opens a dialog and rewrites
 * them only if the user agrees, so the rename resolves once the user
 * answers. Either way the links it may rewrite are the same.
 */
export type LinkUpdateSetting = "always" | "ask";

/** The files Obsidian's link updater may rewrite when an entry is renamed. */
export type LinkSources = {
	/** The renamed entry's path as Obsidian keys it; `null` when nothing is there. */
	readonly target: string | null;
	/**
	 * The files whose resolved links, as `MetadataCache.resolvedLinks` holds
	 * them, point at the target file or, for a folder, at a file below it.
	 */
	readonly sources: readonly string[];
	readonly setting: LinkUpdateSetting;
};

export class VaultIo extends Context.Service<
	VaultIo,
	{
		create(
			path: string,
			content: string,
		): Effect.Effect<TFile, VamVaultIoError>;
		createFolder(path: string): Effect.Effect<TFolder, VamVaultIoError>;
		getAbstractFileByPath(
			path: string,
		): Effect.Effect<TAbstractFile | null, VamVaultIoError>;
		readonly getMarkdownFiles: Effect.Effect<
			readonly TFile[],
			VamVaultIoError
		>;
		modify(
			file: TFile,
			content: string,
		): Effect.Effect<void, VamVaultIoError>;
		/**
		 * Atomically reads, transforms, and saves a file through
		 * `Vault.process`. `fn` runs synchronously against the current
		 * content. Returning that content unchanged writes nothing; throwing
		 * from it aborts without writing.
		 */
		process(
			file: TFile,
			fn: (content: string) => string,
		): Effect.Effect<string, VamVaultIoError>;
		/**
		 * What renaming the entry at `path` through `FileManager.renameFile`
		 * may rewrite, read before the rename from Obsidian's resolved links.
		 */
		linkSources(path: string): Effect.Effect<LinkSources, VamVaultIoError>;
		read(file: TFile): Effect.Effect<string, VamVaultIoError>;
		/**
		 * Renames through `FileManager.renameFile`, which rewrites links to the
		 * file when the user's settings ask for it, or, with `updateLinks:
		 * false`, through `Vault.rename`, which changes no file's content.
		 */
		rename(
			file: TAbstractFile,
			toPath: string,
			options?: { readonly updateLinks?: boolean },
		): Effect.Effect<void, VamVaultIoError>;
		resolveLinkpathDest(
			linkpath: string,
			fromPath: string,
		): Effect.Effect<TFile | null, VamVaultIoError>;
		/** Obsidian's cached stat for a file, as of its last vault change. */
		stat(file: TFile): Effect.Effect<VaultFileStat, VamVaultIoError>;
		trash(file: TAbstractFile): Effect.Effect<void, VamVaultIoError>;
	}
>()("@textfresser/vault-action-manager/VaultIo") {}

export class ActiveEditorAccess extends Context.Service<
	ActiveEditorAccess,
	{
		readonly getActiveEditor: Effect.Effect<
			ActiveEditorHandle | null,
			VamActiveEditorError
		>;
		openFile(file: TFile): Effect.Effect<void, VamActiveEditorError>;
		/**
		 * Every Markdown view that shows the file at `path` (compared case
		 * sensitively), active or not, in workspace order, read in one
		 * synchronous step.
		 */
		markdownViewsOf(
			path: string,
		): Effect.Effect<readonly ActiveEditorHandle[], VamActiveEditorError>;
		/** Paths of the files shown in any Markdown view, active or not. */
		readonly openMarkdownPaths: Effect.Effect<
			ReadonlySet<string>,
			VamActiveEditorError
		>;
		waitForActiveEditor(args: {
			readonly expectedInlineTitleText?: string;
			readonly path: string;
			readonly readiness: ActiveEditorReadiness;
		}): Effect.Effect<ActiveEditorHandle, VamActiveEditorError>;
	}
>()("@textfresser/vault-action-manager/ActiveEditorAccess") {}

export type VamLiveServices = VaultIo | ActiveEditorAccess;
