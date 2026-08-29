import { describe, expect, it, mock } from "bun:test";
import { Effect, Layer } from "effect";
import { TFile } from "obsidian";
import { ActiveEditorAccess, VaultIo } from "../../src/effect/ports";
import type { ActiveFileService } from "../../src/file-services/active-view/active-file-service";
import type { TFileHelper } from "../../src/file-services/background/helpers/tfile-helper";
import { MarkdownFileAccess } from "../../src/file-services/markdown-file-access";
import type { SplitPathToMdFile } from "../../src/types/split-path";

const target: SplitPathToMdFile = {
	basename: "note",
	extension: "md",
	kind: "MdFile",
	pathParts: ["Library"],
};

function makeMarkdownFileAccess(active: boolean) {
	const getContent = mock(() => Effect.succeed("editor content"));
	const processInEditor = mock(() => Effect.succeed("editor result"));
	const processInVault = mock(() => Effect.succeed(new TFile()));
	const file = new TFile();
	file.path = "Library/note.md";
	const activeEditor = {
		getContent,
		isInActiveView: () => Effect.succeed(active),
		processContent: processInEditor,
	} as unknown as ActiveFileService;
	const backgroundVault = {
		getFile: () => Effect.succeed(file),
		processContent: processInVault,
	} as unknown as TFileHelper;
	const read = mock(() => Effect.succeed("vault content"));
	const layer = Layer.merge(
		Layer.succeed(
			VaultIo,
			VaultIo.of({
				create: () => Effect.die("not used"),
				createFolder: () => Effect.die("not used"),
				getAbstractFileByPath: () => Effect.die("not used"),
				getMarkdownFiles: Effect.die("not used"),
				modify: () => Effect.die("not used"),
				read,
				rename: () => Effect.die("not used"),
				resolveLinkpathDest: () => Effect.die("not used"),
				trash: () => Effect.die("not used"),
			}),
		),
		makeActiveEditorLayer(),
	);

	return {
		getContent,
		layer,
		markdownFiles: new MarkdownFileAccess(activeEditor, backgroundVault),
		processInEditor,
		processInVault,
		read,
	};
}

describe("MarkdownFileAccess", () => {
	it("reads an active Markdown file through the editor adapter", async () => {
		const { getContent, layer, markdownFiles, read } =
			makeMarkdownFileAccess(true);

		const content = await Effect.runPromise(
			markdownFiles.readContent(target).pipe(Effect.provide(layer)),
		);

		expect(content).toBe("editor content");
		expect(getContent).toHaveBeenCalledTimes(1);
		expect(read).not.toHaveBeenCalled();
	});

	it("reads a background Markdown file through the vault port", async () => {
		const { getContent, layer, markdownFiles, read } =
			makeMarkdownFileAccess(false);

		const content = await Effect.runPromise(
			markdownFiles.readContent(target).pipe(Effect.provide(layer)),
		);

		expect(content).toBe("vault content");
		expect(getContent).not.toHaveBeenCalled();
		expect(read).toHaveBeenCalledTimes(1);
	});

	it("owns the active/background route for transforms", async () => {
		const active = makeMarkdownFileAccess(true);
		const background = makeMarkdownFileAccess(false);
		const args = { splitPath: target, transform: (value: string) => value };

		await Effect.runPromise(
			active.markdownFiles
				.processContent(args)
				.pipe(Effect.provide(active.layer)),
		);
		await Effect.runPromise(
			background.markdownFiles
				.processContent(args)
				.pipe(Effect.provide(background.layer)),
		);

		expect(active.processInEditor).toHaveBeenCalledTimes(1);
		expect(active.processInVault).not.toHaveBeenCalled();
		expect(background.processInEditor).not.toHaveBeenCalled();
		expect(background.processInVault).toHaveBeenCalledTimes(1);
	});

	it("restores the inline title selection after a successful rename", async () => {
		const saved = { end: 4, start: 1, text: "note" };
		const renamed = new TFile();
		const restore = mock(() => Effect.void);
		const activeEditor = {
			restoreInlineTitleSelection: restore,
			saveInlineTitleSelection: () => Effect.succeed(saved),
		} as unknown as ActiveFileService;
		const backgroundVault = {
			renameFile: () => Effect.succeed(renamed),
		} as unknown as TFileHelper;
		const access = new MarkdownFileAccess(activeEditor, backgroundVault);
		const testLayer = makeMarkdownFileAccess(false).layer;

		const result = await Effect.runPromise(
			access
				.renameFile({ from: target, to: target })
				.pipe(Effect.provide(testLayer)),
		);

		expect(result).toBe(renamed);
		expect(restore).toHaveBeenCalledWith(saved);
	});
});

function makeActiveEditorLayer() {
	return Layer.succeed(
		ActiveEditorAccess,
		ActiveEditorAccess.of({
			getActiveMarkdownView: Effect.succeed(null),
			openFile: () => Effect.void,
		}),
	);
}
