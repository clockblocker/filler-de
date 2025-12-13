import { describe, expect, it } from "bun:test";
import {
	SPLIT_PATH_TO_ROOT_FOLDER,
	systemPathToSplitPath,
} from "../../../src/obsidian-vault-action-manager/helpers/pathfinder";
import { SplitPathType } from "../../../src/obsidian-vault-action-manager/types/split-path";

describe("systemPathToSplitPath codec", () => {
	describe("decode (string → SplitPath)", () => {
		it("decodes root path to root folder", () => {
			const result = systemPathToSplitPath.decode("");
			expect(result).toEqual(SPLIT_PATH_TO_ROOT_FOLDER);
		});

		it("decodes normalized root path to root folder", () => {
			const result = systemPathToSplitPath.decode("///");
			expect(result).toEqual(SPLIT_PATH_TO_ROOT_FOLDER);
		});

		it("decodes md file path", () => {
			const result = systemPathToSplitPath.decode("root/notes/file.md");
			expect(result).toEqual({
				basename: "file",
				extension: "md",
				pathParts: ["root", "notes"],
				type: SplitPathType.MdFile,
			});
		});

		it("decodes nested md file path", () => {
			const result = systemPathToSplitPath.decode(
				"Library/Section/Note-Section.md",
			);
			expect(result).toEqual({
				basename: "Note-Section",
				extension: "md",
				pathParts: ["Library", "Section"],
				type: SplitPathType.MdFile,
			});
		});

		it("decodes non-md file path", () => {
			const result = systemPathToSplitPath.decode("root/assets/image.png");
			expect(result).toEqual({
				basename: "image",
				extension: "png",
				pathParts: ["root", "assets"],
				type: SplitPathType.File,
			});
		});

		it("decodes folder path", () => {
			const result = systemPathToSplitPath.decode("root/library/Section");
			expect(result).toEqual({
				basename: "Section",
				pathParts: ["root", "library"],
				type: SplitPathType.Folder,
			});
		});

		it("decodes single-segment folder", () => {
			const result = systemPathToSplitPath.decode("Library");
			expect(result).toEqual({
				basename: "Library",
				pathParts: [],
				type: SplitPathType.Folder,
			});
		});

		it("normalizes leading slashes", () => {
			const result = systemPathToSplitPath.decode("///root/file.md");
			expect(result).toEqual({
				basename: "file",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathType.MdFile,
			});
		});

		it("normalizes trailing slashes", () => {
			const result = systemPathToSplitPath.decode("root/folder///");
			expect(result).toEqual({
				basename: "folder",
				pathParts: ["root"],
				type: SplitPathType.Folder,
			});
		});

		it("handles file with multiple dots in name", () => {
			const result = systemPathToSplitPath.decode("root/file.name.md");
			expect(result).toEqual({
				basename: "file.name",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathType.MdFile,
			});
		});

		it("handles empty path parts", () => {
			const result = systemPathToSplitPath.decode("//root//file.md//");
			expect(result).toEqual({
				basename: "file",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathType.MdFile,
			});
		});
	});

	describe("encode (SplitPath → string)", () => {
		it("encodes root folder", () => {
			const result = systemPathToSplitPath.encode(SPLIT_PATH_TO_ROOT_FOLDER);
			expect(result).toBe("");
		});

		it("encodes md file", () => {
			const splitPath = {
				basename: "file",
				extension: "md",
				pathParts: ["root", "notes"],
				type: SplitPathType.MdFile,
			};
			const result = systemPathToSplitPath.encode(splitPath);
			expect(result).toBe("root/notes/file.md");
		});

		it("encodes nested md file", () => {
			const splitPath = {
				basename: "Note-Section",
				extension: "md",
				pathParts: ["Library", "Section"],
				type: SplitPathType.MdFile,
			};
			const result = systemPathToSplitPath.encode(splitPath);
			expect(result).toBe("Library/Section/Note-Section.md");
		});

		it("encodes non-md file", () => {
			const splitPath = {
				basename: "image",
				extension: "png",
				pathParts: ["root", "assets"],
				type: SplitPathType.File,
			};
			const result = systemPathToSplitPath.encode(splitPath);
			expect(result).toBe("root/assets/image.png");
		});

		it("encodes folder", () => {
			const splitPath = {
				basename: "Section",
				pathParts: ["root", "library"],
				type: SplitPathType.Folder,
			};
			const result = systemPathToSplitPath.encode(splitPath);
			expect(result).toBe("root/library/Section");
		});

		it("encodes single-segment folder", () => {
			const splitPath = {
				basename: "Library",
				pathParts: [],
				type: SplitPathType.Folder,
			};
			const result = systemPathToSplitPath.encode(splitPath);
			expect(result).toBe("Library");
		});

		it("sanitizes basename with slashes", () => {
			const splitPath = {
				basename: "file/name",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathType.MdFile,
			};
			const result = systemPathToSplitPath.encode(splitPath);
			expect(result).toBe("root/file name.md");
		});

		it("sanitizes basename with backslashes", () => {
			const splitPath = {
				basename: "file\\name",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathType.MdFile,
			};
			const result = systemPathToSplitPath.encode(splitPath);
			expect(result).toBe("root/file name.md");
		});

		it("preserves special characters that Obsidian allows", () => {
			const splitPath = {
				basename: "file-with-!@#$%",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathType.MdFile,
			};
			const result = systemPathToSplitPath.encode(splitPath);
			// Obsidian accepts these characters - they should be preserved
			expect(result).toBe("root/file-with-!@#$%.md");
		});

		it("preserves spaces in basename", () => {
			const splitPath = {
				basename: "file with spaces",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathType.MdFile,
			};
			const result = systemPathToSplitPath.encode(splitPath);
			expect(result).toBe("root/file with spaces.md");
		});

		it("trims basename whitespace", () => {
			const splitPath = {
				basename: "  file  ",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathType.MdFile,
			};
			const result = systemPathToSplitPath.encode(splitPath);
			expect(result).toBe("root/file.md");
		});
	});

	describe("round-trip (encode/decode)", () => {
		it("round-trips root folder", () => {
			const original = SPLIT_PATH_TO_ROOT_FOLDER;
			const encoded = systemPathToSplitPath.encode(original);
			const decoded = systemPathToSplitPath.decode(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips md file", () => {
			const original = {
				basename: "file",
				extension: "md",
				pathParts: ["root", "notes"],
				type: SplitPathType.MdFile,
			};
			const encoded = systemPathToSplitPath.encode(original);
			const decoded = systemPathToSplitPath.decode(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips nested md file", () => {
			const original = {
				basename: "Note-Section",
				extension: "md",
				pathParts: ["Library", "Section", "Subsection"],
				type: SplitPathType.MdFile,
			};
			const encoded = systemPathToSplitPath.encode(original);
			const decoded = systemPathToSplitPath.decode(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips non-md file", () => {
			const original = {
				basename: "image",
				extension: "png",
				pathParts: ["root", "assets"],
				type: SplitPathType.File,
			};
			const encoded = systemPathToSplitPath.encode(original);
			const decoded = systemPathToSplitPath.decode(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips folder", () => {
			const original = {
				basename: "Section",
				pathParts: ["root", "library"],
				type: SplitPathType.Folder,
			};
			const encoded = systemPathToSplitPath.encode(original);
			const decoded = systemPathToSplitPath.decode(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips single-segment folder", () => {
			const original = {
				basename: "Library",
				pathParts: [],
				type: SplitPathType.Folder,
			};
			const encoded = systemPathToSplitPath.encode(original);
			const decoded = systemPathToSplitPath.decode(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips file with dots in basename", () => {
			const original = {
				basename: "file.name",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathType.MdFile,
			};
			const encoded = systemPathToSplitPath.encode(original);
			const decoded = systemPathToSplitPath.decode(encoded);
			expect(decoded).toEqual(original);
		});
	});

	describe("edge cases", () => {
		it("handles file with only extension", () => {
			const result = systemPathToSplitPath.decode(".md");
			expect(result).toEqual({
				basename: "",
				extension: "md",
				pathParts: [],
				type: SplitPathType.MdFile,
			});
		});

		it("handles deeply nested paths", () => {
			const result = systemPathToSplitPath.decode(
				"a/b/c/d/e/f/g/h/file.md",
			);
			expect(result).toEqual({
				basename: "file",
				extension: "md",
				pathParts: ["a", "b", "c", "d", "e", "f", "g", "h"],
				type: SplitPathType.MdFile,
			});
		});

		it("handles unicode characters in path", () => {
			const splitPath = {
				basename: "café",
				extension: "md",
				pathParts: ["répertoire"],
				type: SplitPathType.MdFile,
			};
			const encoded = systemPathToSplitPath.encode(splitPath);
			const decoded = systemPathToSplitPath.decode(encoded);
			expect(decoded).toEqual(splitPath);
		});

		it("sanitizes path separators in basename", () => {
			const splitPath = {
				basename: "file/name\\with-separators",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathType.MdFile,
			};
			const encoded = systemPathToSplitPath.encode(splitPath);
			// Only path separators (/ and \) are sanitized to spaces
			// Other special chars are preserved (Obsidian's behavior is golden source)
			expect(encoded).toBe("root/file name with-separators.md");
		});

		it("preserves Obsidian-allowed special characters", () => {
			const splitPath = {
				basename: "file!@#$%with-special",
				extension: "md",
				pathParts: ["root"],
				type: SplitPathType.MdFile,
			};
			const encoded = systemPathToSplitPath.encode(splitPath);
			// Obsidian accepts these characters - they should be preserved
			expect(encoded).toBe("root/file!@#$%with-special.md");
		});
	});
});
