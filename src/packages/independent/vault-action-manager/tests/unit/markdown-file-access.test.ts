import { describe, expect, it, mock } from "bun:test";
import { ok } from "neverthrow";
import { TFile, type Vault } from "obsidian";
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
	const getContent = mock(() => ok("editor content"));
	const processInEditor = mock(() => ok("editor result"));
	const processInVault = mock(async () => ok(new TFile()));
	const file = new TFile();
	file.path = "Library/note.md";
	const activeEditor = {
		getContent,
		isInActiveView: () => active,
		processContent: processInEditor,
	} as unknown as ActiveFileService;
	const backgroundVault = {
		getFile: () => ok(file),
		processContent: processInVault,
	} as unknown as TFileHelper;
	const vault = {
		read: mock(async () => "vault content"),
	} as unknown as Vault;

	return {
		getContent,
		markdownFiles: new MarkdownFileAccess(
			activeEditor,
			backgroundVault,
			vault,
		),
		processInEditor,
		processInVault,
		vault,
	};
}

describe("MarkdownFileAccess", () => {
	it("reads an active Markdown file through the editor adapter", async () => {
		const { getContent, markdownFiles, vault } =
			makeMarkdownFileAccess(true);

		const result = await markdownFiles.readContent(target);

		expect(result._unsafeUnwrap()).toBe("editor content");
		expect(getContent).toHaveBeenCalledTimes(1);
		expect(vault.read).not.toHaveBeenCalled();
	});

	it("reads a background Markdown file through the vault adapter", async () => {
		const { getContent, markdownFiles, vault } =
			makeMarkdownFileAccess(false);

		const result = await markdownFiles.readContent(target);

		expect(result._unsafeUnwrap()).toBe("vault content");
		expect(getContent).not.toHaveBeenCalled();
		expect(vault.read).toHaveBeenCalledTimes(1);
	});

	it("owns the active/background route for transforms", async () => {
		const active = makeMarkdownFileAccess(true);
		const background = makeMarkdownFileAccess(false);
		const args = { splitPath: target, transform: (value: string) => value };

		await active.markdownFiles.processContent(args);
		await background.markdownFiles.processContent(args);

		expect(active.processInEditor).toHaveBeenCalledTimes(1);
		expect(active.processInVault).not.toHaveBeenCalled();
		expect(background.processInEditor).not.toHaveBeenCalled();
		expect(background.processInVault).toHaveBeenCalledTimes(1);
	});
});
