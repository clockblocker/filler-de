import { describe, expect, it } from "bun:test";
import { Effect, Layer, Result } from "effect";
import { TFile, TFolder } from "obsidian";
import { VamDispatchError, VamVaultIoError } from "../../src/effect/errors";
import { ActiveEditorAccess, VaultIo } from "../../src/effect/ports";
import type { TFileHelper } from "../../src/file-services/background/helpers/tfile-helper";
import type { TFolderHelper } from "../../src/file-services/background/helpers/tfolder-helper";
import type { MarkdownFileAccess } from "../../src/file-services/markdown-file-access";
import { Executor } from "../../src/impl/actions-processing/executor";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../src/types/split-path";
import {
	type VaultAction,
	VaultActionKind,
} from "../../src/types/vault-action";

const folder: SplitPathToFolder = {
	basename: "folder",
	kind: "Folder",
	pathParts: [],
};
const nextFolder: SplitPathToFolder = { ...folder, basename: "next-folder" };
const file: SplitPathToFile = {
	basename: "asset",
	extension: "pdf",
	kind: "File",
	pathParts: [],
};
const nextFile: SplitPathToFile = { ...file, basename: "next-asset" };
const markdown: SplitPathToMdFile = {
	basename: "note",
	extension: "md",
	kind: "MdFile",
	pathParts: [],
};
const nextMarkdown: SplitPathToMdFile = { ...markdown, basename: "next-note" };

const actions: readonly VaultAction[] = [
	{ kind: VaultActionKind.CreateFolder, payload: { splitPath: folder } },
	{
		kind: VaultActionKind.RenameFolder,
		payload: { from: folder, to: nextFolder },
	},
	{ kind: VaultActionKind.TrashFolder, payload: { splitPath: folder } },
	{
		kind: VaultActionKind.CreateFile,
		payload: { content: "file", splitPath: file },
	},
	{
		kind: VaultActionKind.RenameFile,
		payload: { from: file, to: nextFile },
	},
	{ kind: VaultActionKind.TrashFile, payload: { splitPath: file } },
	{
		kind: VaultActionKind.UpsertMdFile,
		payload: { content: "note", splitPath: markdown },
	},
	{
		kind: VaultActionKind.RenameMdFile,
		payload: { from: markdown, to: nextMarkdown },
	},
	{ kind: VaultActionKind.TrashMdFile, payload: { splitPath: markdown } },
	{
		kind: VaultActionKind.ProcessMdFile,
		payload: { after: "after", before: "before", splitPath: markdown },
	},
];

function failure(operation: string) {
	return new VamVaultIoError({
		cause: new Error(operation),
		operation,
	});
}

function dependencies(mode: "success" | "failure") {
	const tfile = new TFile();
	const tfolder = new TFolder();
	const effect = <A>(value: A, operation: string) =>
		mode === "success"
			? Effect.succeed(value)
			: Effect.fail(failure(operation));
	const tfileHelper = {
		getFile: () => effect(tfile, "getFile"),
		processContent: () => effect(tfile, "processContent"),
		renameFile: () => effect(tfile, "renameFile"),
		trashFile: () => effect(undefined, "trashFile"),
		upsertMdFile: () => effect(tfile, "upsertMdFile"),
	} as unknown as TFileHelper;
	const tfolderHelper = {
		createFolder: () => effect(tfolder, "createFolder"),
		renameFolder: () => effect(tfolder, "renameFolder"),
		trashFolder: () => effect(undefined, "trashFolder"),
	} as unknown as TFolderHelper;
	const markdownFiles = {
		processContent: () => effect(tfile, "processMarkdown"),
		renameFile: () => effect(tfile, "renameMarkdown"),
		replaceContent: () => effect(tfile, "replaceMarkdown"),
	} as unknown as MarkdownFileAccess;
	return { markdownFiles, tfileHelper, tfolderHelper };
}

function services(mode: "success" | "failure") {
	const tfile = new TFile();
	const effect = <A>(value: A, operation: string) =>
		mode === "success"
			? Effect.succeed(value)
			: Effect.fail(failure(operation));
	return Layer.merge(
		Layer.succeed(
			VaultIo,
			VaultIo.of({
				create: () => effect(tfile, "create"),
				createFolder: () => Effect.die("not used"),
				getAbstractFileByPath: () => Effect.die("not used"),
				getMarkdownFiles: Effect.die("not used"),
				modify: () => Effect.die("not used"),
				read: () => Effect.die("not used"),
				rename: () => Effect.die("not used"),
				resolveLinkpathDest: () => Effect.die("not used"),
				trash: () => Effect.die("not used"),
			}),
		),
		Layer.succeed(
			ActiveEditorAccess,
			ActiveEditorAccess.of({
				getActiveMarkdownView: Effect.succeed(null),
				openFile: () => Effect.void,
			}),
		),
	);
}

describe("Effect-native Executor", () => {
	it("executes every action kind successfully through the native seam", async () => {
		const deps = dependencies("success");
		const executor = new Executor(
			deps.tfileHelper,
			deps.tfolderHelper,
			deps.markdownFiles,
		);

		for (const action of actions) {
			const result = await Effect.runPromise(
				Effect.result(executor.execute(action)).pipe(
					Effect.provide(services("success")),
				),
			);
			expect(Result.isSuccess(result)).toBe(true);
		}
	});

	it("attributes every action kind failure to that action", async () => {
		const deps = dependencies("failure");
		const executor = new Executor(
			deps.tfileHelper,
			deps.tfolderHelper,
			deps.markdownFiles,
		);

		for (const action of actions) {
			const result = await Effect.runPromise(
				Effect.result(executor.execute(action)).pipe(
					Effect.provide(services("failure")),
				),
			);
			expect(Result.isFailure(result)).toBe(true);
			if (Result.isFailure(result)) {
				expect(result.failure).toBeInstanceOf(VamDispatchError);
				expect(result.failure.action).toBe(action);
				expect(result.failure.operation).toBe(`execute.${action.kind}`);
			}
		}
	});
});
