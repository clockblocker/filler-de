import { describe, expect, it } from "bun:test";
import { TFile, TFolder } from "obsidian";
import {
	splitPath,
	splitPathKey,
} from "../../../src/obsidian-vault-action-manager";

describe("obsidian-vault-action-manager splitPath helpers", () => {
	it("splits md file paths from strings", () => {
		const split = splitPath("root/notes/file.md");

		expect(split).toEqual({
			basename: "file",
			extension: "md",
			pathParts: ["root", "notes"],
			type: "MdFile",
		});
		expect(splitPathKey(split)).toBe("root/notes/file.md");
	});

	it("splits non-md file paths from strings", () => {
		const split = splitPath("root/assets/image.png");

		expect(split).toEqual({
			basename: "image.png",
			extension: "png",
			pathParts: ["root", "assets"],
			type: "File",
		});
		expect(splitPathKey(split)).toBe("root/assets/image.png");
	});

	it("splits folder paths from strings without extension", () => {
		const split = splitPath("root/library/Section");

		expect(split).toEqual({
			basename: "Section",
			pathParts: ["root", "library"],
			type: "Folder",
		});
		expect(splitPathKey(split)).toBe("root/library/Section");
	});

	it("splits TFile instances", () => {
		const file = new TFile();
		file.path = "root/notes/file.md";
		file.extension = "md";
		// @ts-expect-error allow assigning for test double
		file.basename = "file";

		const split = splitPath(file);

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

		const split = splitPath(folder);

		expect(split).toEqual({
			basename: "library",
			pathParts: ["root"],
			type: "Folder",
		});
	});
});
