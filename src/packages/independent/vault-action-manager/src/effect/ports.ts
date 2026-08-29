import { Context, type Effect } from "effect";
import type { MarkdownView, TAbstractFile, TFile, TFolder } from "obsidian";
import type { VamVaultIoError } from "./errors";

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
		readonly getActiveMarkdownView: Effect.Effect<
			MarkdownView | null,
			VamVaultIoError
		>;
		openFile(file: TFile): Effect.Effect<void, VamVaultIoError>;
	}
>()("@textfresser/vault-action-manager/ActiveEditorAccess") {}

export type VamLiveServices = VaultIo | ActiveEditorAccess;
