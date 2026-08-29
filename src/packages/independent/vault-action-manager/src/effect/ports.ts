import { Context, type Effect } from "effect";
import type { Editor, TAbstractFile, TFile, TFolder } from "obsidian";
import type { VamActiveEditorError, VamVaultIoError } from "./errors";

export type ActiveEditor = Pick<
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

/** Narrow production/test seam captured from one active Markdown view lookup. */
export type ActiveEditorHandle = {
	readonly editor: ActiveEditor;
	readonly file: TFile | null;
	readonly mode: string;
	isCurrent(): boolean;
	readInlineTitleSelection(): SavedInlineTitleSelection | null;
	restoreInlineTitleSelection(saved: SavedInlineTitleSelection): void;
};

export type ActiveEditorReadiness = "editor" | "inline-title";

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
		read(file: TFile): Effect.Effect<string, VamVaultIoError>;
		rename(
			file: TAbstractFile,
			toPath: string,
		): Effect.Effect<void, VamVaultIoError>;
		resolveLinkpathDest(
			linkpath: string,
			fromPath: string,
		): Effect.Effect<TFile | null, VamVaultIoError>;
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
		waitForActiveEditor(args: {
			readonly expectedInlineTitleText?: string;
			readonly path: string;
			readonly readiness: ActiveEditorReadiness;
		}): Effect.Effect<ActiveEditorHandle, VamActiveEditorError>;
	}
>()("@textfresser/vault-action-manager/ActiveEditorAccess") {}

export type VamLiveServices = VaultIo | ActiveEditorAccess;
