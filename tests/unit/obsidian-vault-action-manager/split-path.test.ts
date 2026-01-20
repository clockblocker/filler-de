import { describe, expect, it } from "bun:test";
import { TFile, TFolder } from "obsidian";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
} from "../../../src/managers/obsidian/vault-action-manager";
import { MD } from "../../../src/managers/obsidian/vault-action-manager/types/literals";

describe("obsidian-vault-action-manager splitPath helpers", () => {
	it("splits md file paths from strings", () => {
		const split = makeSplitPath("root/notes/file.md");

		expect(split).toEqual({
			basename: "file",
			extension: MD,
			kind: "MdFile",
			pathParts: ["root", "notes"],
		});
		expect(makeSystemPathForSplitPath(split)).toBe("root/notes/file.md");
	});

	it("splits non-md file paths from strings", () => {
		const split = makeSplitPath("root/assets/image.png");

		expect(split).toEqual({
			basename: "image",
			extension: "png",
			kind: "File",
			pathParts: ["root", "assets"],
		});
		expect(makeSystemPathForSplitPath(split)).toBe("root/assets/image.png");
	});

	it("splits folder paths from strings without extension", () => {
		const split = makeSplitPath("root/library/Section");

		expect(split).toEqual({
			basename: "Section",
			kind: "Folder",
			pathParts: ["root", "library"],
		});
		expect(makeSystemPathForSplitPath(split)).toBe("root/library/Section");
	});

	it("splits TFile instances", () => {
		const file = new TFile();
		file.path = "root/notes/file.md";
		file.extension = "md";

		const split = makeSplitPath(file);

		expect(split).toEqual({
			basename: "file",
			extension: MD,
			kind: "MdFile",
			pathParts: ["root", "notes"],
		});
	});

	it("splits TFolder instances", () => {
		const folder = new TFolder();
		folder.path = "root/library";

		const split = makeSplitPath(folder);

		expect(split).toEqual({
			basename: "library",
			kind: "Folder",
			pathParts: ["root"],
		});
	});
});
