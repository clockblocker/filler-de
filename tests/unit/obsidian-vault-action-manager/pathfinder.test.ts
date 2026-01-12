import { describe, expect, it } from "bun:test";
import {
	SPLIT_PATH_TO_ROOT_FOLDER,
	splitPathFromSystemPathInternal,
	systemPathFromSplitPathInternal,
} from "../../../src/managers/obsidian/vault-action-manager/helpers/pathfinder";
import { type SplitPathToFile, type SplitPathToFolder, type SplitPathToMdFile, SplitPathKind } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";

describe("systemPathFromSplitPathInternal | splitPathFromSystemPathInternal", () => {
	describe("decode (string → SplitPath)", () => {
		it("decodes root path to root folder", () => {
			const result = splitPathFromSystemPathInternal("");
			expect(result).toEqual(SPLIT_PATH_TO_ROOT_FOLDER);
		});

		it("decodes normalized root path to root folder", () => {
			const result = splitPathFromSystemPathInternal("///");
			expect(result).toEqual(SPLIT_PATH_TO_ROOT_FOLDER);
		});

		it("decodes md file path", () => {
			const result = splitPathFromSystemPathInternal("root/notes/file.md");
			expect(result).toEqual({
				basename: "file",
				extension: "md",
				pathParts: ["root", "notes"],
				type: SplitPathKind.MdFile,
			});
		});

		it("decodes nested md file path", () => {
			const result = splitPathFromSystemPathInternal(
				"Library/Section/Note-Section.md",
			);
			expect(result).toEqual({
				basename: "Note-Section",
				extension: "md",
				pathParts: ["Library", "Section"],
				type: SplitPathKind.MdFile,
			});
		});

		it("decodes non-md file path", () => {
			const result = splitPathFromSystemPathInternal("root/assets/image.png");
			expect(result).toEqual({
				basename: "image",
				extension: "png",
				pathParts: ["root", "assets"],
				type: SplitPathKind.File,
			});
		});

		it("decodes folder path", () => {
			const result = splitPathFromSystemPathInternal("root/library/Section");
			expect(result).toEqual({
				basename: "Section",
				pathParts: ["root", "library"],
				type: SplitPathKind.Folder,
			});
		});

		it("decodes single-segment folder", () => {
			const result = splitPathFromSystemPathInternal("Library");
			expect(result).toEqual({
				basename: "Library",
				pathParts: [],
				type: SplitPathKind.Folder,
			});
		});

		it("normalizes leading slashes", () => {
			const result = splitPathFromSystemPathInternal("///root/file.md");
			expect(result).toEqual({
				basename: "file",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathKind.MdFile,
			});
		});

		it("normalizes trailing slashes", () => {
			const result = splitPathFromSystemPathInternal("root/folder///");
			expect(result).toEqual({
				basename: "folder",
				pathParts: ["root"],
				type: SplitPathKind.Folder,
			});
		});

		it("handles file with multiple dots in name", () => {
			const result = splitPathFromSystemPathInternal("root/file.name.md");
			expect(result).toEqual({
				basename: "file.name",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathKind.MdFile,
			});
		});

		it("handles empty path parts", () => {
			const result = splitPathFromSystemPathInternal("//root//file.md//");
			expect(result).toEqual({
				basename: "file",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathKind.MdFile,
			});
		});
	});

	describe("encode (SplitPath → string)", () => {
		it("encodes root folder", () => {
			const result = systemPathFromSplitPathInternal(SPLIT_PATH_TO_ROOT_FOLDER);
			expect(result).toBe("");
		});

		it("encodes md file", () => {
			const splitPath = {
				basename: "file",
				extension: "md",
				pathParts: ["root", "notes"],
				type: SplitPathKind.MdFile,
			} as SplitPathToMdFile;
			const result = systemPathFromSplitPathInternal(splitPath);
			expect(result).toBe("root/notes/file.md");
		});

		it("encodes nested md file", () => {
			const splitPath = {
				basename: "Note-Section",
				extension: "md",
				pathParts: ["Library", "Section"],
				type: SplitPathKind.MdFile,
			} as SplitPathToMdFile;
			const result = systemPathFromSplitPathInternal(splitPath);
			expect(result).toBe("Library/Section/Note-Section.md");
		});

		it("encodes non-md file", () => {
			const splitPath = {
				basename: "image",
				extension: "png",
				pathParts: ["root", "assets"],
				type: SplitPathKind.File,
			};
			const result = systemPathFromSplitPathInternal(splitPath);
			expect(result).toBe("root/assets/image.png");
		});

		it("encodes folder", () => {
			const splitPath = {
				basename: "Section",
				pathParts: ["root", "library"],
				type: SplitPathKind.Folder,
			};
			const result = systemPathFromSplitPathInternal(splitPath);
			expect(result).toBe("root/library/Section");
		});

		it("encodes single-segment folder", () => {
			const splitPath = {
				basename: "Library",
				pathParts: [],
				type: SplitPathKind.Folder,
			};
			const result = systemPathFromSplitPathInternal(splitPath);
			expect(result).toBe("Library");
		});

		it("sanitizes basename with slashes", () => {
			const splitPath = {
				basename: "file/name",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathKind.MdFile,
			} as SplitPathToMdFile;
			const result = systemPathFromSplitPathInternal(splitPath);
			expect(result).toBe("root/file name.md");
		});

		it("sanitizes basename with backslashes", () => {
			const splitPath = {
				basename: "file\\name",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathKind.MdFile,
			} as SplitPathToMdFile;
			const result = systemPathFromSplitPathInternal(splitPath);
			expect(result).toBe("root/file name.md");
		});

		it("preserves special characters that Obsidian allows", () => {
			const splitPath = {
				basename: "file-with-!@#$%",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathKind.MdFile,
			} as SplitPathToMdFile;
			const result = systemPathFromSplitPathInternal(splitPath);
			// Obsidian accepts these characters - they should be preserved
			expect(result).toBe("root/file-with-!@#$%.md");
		});

		it("preserves spaces in basename", () => {
			const splitPath = {
				basename: "file with spaces",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathKind.MdFile,
			} as SplitPathToMdFile;
			const result = systemPathFromSplitPathInternal(splitPath);
			expect(result).toBe("root/file with spaces.md");
		});

		it("trims basename whitespace", () => {
			const splitPath = {
				basename: "  file  ",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathKind.MdFile,
			} as SplitPathToMdFile;
			const result = systemPathFromSplitPathInternal(splitPath);
			expect(result).toBe("root/file.md");
		});
	});

	describe("round-trip (encode/decode)", () => {
		it("round-trips root folder", () => {
			const original = SPLIT_PATH_TO_ROOT_FOLDER;
			const encoded = systemPathFromSplitPathInternal(original);
			const decoded = splitPathFromSystemPathInternal(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips md file", () => {
			const original = {
				basename: "file",
				extension: "md",
				pathParts: ["root", "notes"],
				type: SplitPathKind.MdFile,
			} as SplitPathToMdFile;
			const encoded = systemPathFromSplitPathInternal(original);
			const decoded = splitPathFromSystemPathInternal(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips nested md file", () => {
			const original = {
				basename: "Note-Section",
				extension: "md",
				pathParts: ["Library", "Section", "Subsection"],
				type: SplitPathKind.MdFile,
			} as SplitPathToMdFile;
			const encoded = systemPathFromSplitPathInternal(original);
			const decoded = splitPathFromSystemPathInternal(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips non-md file", () => {
			const original = {
				basename: "image",
				extension: "png",
				pathParts: ["root", "assets"],
				type: SplitPathKind.File,
			} as SplitPathToFile;
			const encoded = systemPathFromSplitPathInternal(original);
			const decoded = splitPathFromSystemPathInternal(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips folder", () => {
			const original = {
				basename: "Section",
				pathParts: ["root", "library"],
				type: SplitPathKind.Folder,
			} as SplitPathToFolder;
			const encoded = systemPathFromSplitPathInternal(original);
			const decoded = splitPathFromSystemPathInternal(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips single-segment folder", () => {
			const original = {
				basename: "Library",
				pathParts: [],
				type: SplitPathKind.Folder,
			};
			const encoded = systemPathFromSplitPathInternal(original);
			const decoded = splitPathFromSystemPathInternal(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips file with dots in basename", () => {
			const original = {
				basename: "file.name",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathKind.MdFile,
			} as SplitPathToMdFile;
			const encoded = systemPathFromSplitPathInternal(original);
			const decoded = splitPathFromSystemPathInternal(encoded);
			expect(decoded).toEqual(original);
		});
	});

	describe("edge cases", () => {
		it("handles file with only extension", () => {
			const result = splitPathFromSystemPathInternal(".md");
			expect(result).toEqual({
				basename: "",
				extension: "md",
				pathParts: [],
				type: SplitPathKind.MdFile,
			});
		});

		it("handles deeply nested paths", () => {
			const result = splitPathFromSystemPathInternal(
				"a/b/c/d/e/f/g/h/file.md",
			);
			expect(result).toEqual({
				basename: "file",
				extension: "md",
				pathParts: ["a", "b", "c", "d", "e", "f", "g", "h"],
				type: SplitPathKind.MdFile,
			});
		});

		it("handles unicode characters in path", () => {
			const splitPath = {
				basename: "café",
				extension: "md",
				pathParts: ["répertoire"],
				type: SplitPathKind.MdFile,
			} as SplitPathToMdFile;
			const encoded = systemPathFromSplitPathInternal(splitPath);
			const decoded = splitPathFromSystemPathInternal(encoded);
			expect(decoded).toEqual(splitPath);
		});

		it("sanitizes path separators in basename", () => {
			const splitPath = {
				basename: "file/name\\with-separators",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathKind.MdFile,
			} as SplitPathToMdFile;
			const encoded = systemPathFromSplitPathInternal(splitPath);
			// Only path separators (/ and \) are sanitized to spaces
			// Other special chars are preserved (Obsidian's behavior is golden source)
			expect(encoded).toBe("root/file name with-separators.md");
		});

		it("preserves Obsidian-allowed special characters", () => {
			const splitPath = {
				basename: "file!@#$%with-special",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathKind.MdFile,
			} as SplitPathToMdFile;
			const encoded = systemPathFromSplitPathInternal(splitPath);
			// Obsidian accepts these characters - they should be preserved
			expect(encoded).toBe("root/file!@#$%with-special.md");
		});
	});
});
