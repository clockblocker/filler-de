import { describe, expect, it } from "bun:test";
import { TFile, TFolder } from "obsidian";
import {
	makeSplitPath,
	makeSystemPathForSplitPath,
} from "../../../src/obsidian-vault-action-manager";

describe("obsidian-vault-action-manager splitPath helpers", () => {
	it("splits md file paths from strings", () => {
		const split = makeSplitPath("root/notes/file.md");

		expect(split).toEqual({
			basename: "file",
			extension: "md",
			pathParts: ["root", "notes"],
			type: "MdFile",
		});
		expect(makeSystemPathForSplitPath(split)).toBe("root/notes/file.md");
	});

	it("splits non-md file paths from strings", () => {
		const split = makeSplitPath("root/assets/image.png");

		expect(split).toEqual({
			basename: "image",
			extension: "png",
			pathParts: ["root", "assets"],
			type: "File",
		});
		expect(makeSystemPathForSplitPath(split)).toBe("root/assets/image.png");
	});

	it("splits folder paths from strings without extension", () => {
		const split = makeSplitPath("root/library/Section");

		expect(split).toEqual({
			basename: "Section",
			pathParts: ["root", "library"],
			type: "Folder",
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
			extension: "md",
			pathParts: ["root", "notes"],
			type: "MdFile",
		});
	});

	it("splits TFolder instances", () => {
		const folder = new TFolder();
		folder.path = "root/library";

		const split = makeSplitPath(folder);

		expect(split).toEqual({
			basename: "library",
			pathParts: ["root"],
			type: "Folder",
		});
	});
});
