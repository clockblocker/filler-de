import { describe, expect, it } from "bun:test";
import { pathfinder } from "../../../src/managers/obsidian/vault-action-manager/helpers/pathfinder";
import { MD } from "../../../src/managers/obsidian/vault-action-manager/types/literals";
import { SplitPathKind, type SplitPathToFile, type SplitPathToFolder, type SplitPathToMdFile } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";

describe("pathfinder.systemPathFromSplitPath | pathfinder.splitPathFromSystemPath", () => {
	describe("decode (string → SplitPath)", () => {
		it("decodes root path to root folder", () => {
			const result = pathfinder.splitPathFromSystemPath("");
			expect(result).toEqual(pathfinder.SPLIT_PATH_TO_ROOT_FOLDER);
		});

		it("decodes normalized root path to root folder", () => {
			const result = pathfinder.splitPathFromSystemPath("///");
			expect(result).toEqual(pathfinder.SPLIT_PATH_TO_ROOT_FOLDER);
		});

		it("decodes md file path", () => {
			const result = pathfinder.splitPathFromSystemPath("root/notes/file.md");
			expect(result).toEqual({
				basename: "file",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["root", "notes"],
			});
		});

		it("decodes nested md file path", () => {
			const result = pathfinder.splitPathFromSystemPath(
				"Library/Section/Note-Section.md",
			);
			expect(result).toEqual({
				basename: "Note-Section",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section"],
			});
		});

		it("decodes non-md file path", () => {
			const result = pathfinder.splitPathFromSystemPath("root/assets/image.png");
			expect(result).toEqual({
				basename: "image",
				extension: "png",
				kind: SplitPathKind.File,
				pathParts: ["root", "assets"],
			});
		});

		it("decodes folder path", () => {
			const result = pathfinder.splitPathFromSystemPath("root/library/Section");
			expect(result).toEqual({
				basename: "Section",
				kind: SplitPathKind.Folder,
				pathParts: ["root", "library"],
			});
		});

		it("decodes single-segment folder", () => {
			const result = pathfinder.splitPathFromSystemPath("Library");
			expect(result).toEqual({
				basename: "Library",
				kind: SplitPathKind.Folder,
				pathParts: [],
			});
		});

		it("normalizes leading slashes", () => {
			const result = pathfinder.splitPathFromSystemPath("///root/file.md");
			expect(result).toEqual({
				basename: "file",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["root"],
			});
		});

		it("normalizes trailing slashes", () => {
			const result = pathfinder.splitPathFromSystemPath("root/folder///");
			expect(result).toEqual({
				basename: "folder",
				kind: SplitPathKind.Folder,
				pathParts: ["root"],
			});
		});

		it("handles file with multiple dots in name", () => {
			const result = pathfinder.splitPathFromSystemPath("root/file.name.md");
			expect(result).toEqual({
				basename: "file.name",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["root"],
			});
		});

		it("handles empty path parts", () => {
			const result = pathfinder.splitPathFromSystemPath("//root//file.md//");
			expect(result).toEqual({
				basename: "file",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["root"],
			});
		});
	});

	describe("encode (SplitPath → string)", () => {
		it("encodes root folder", () => {
			const result = pathfinder.systemPathFromSplitPath(pathfinder.SPLIT_PATH_TO_ROOT_FOLDER);
			expect(result).toBe("");
		});

		it("encodes md file", () => {
			const splitPath = {
				basename: "file",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["root", "notes"],
			} as SplitPathToMdFile;
			const result = pathfinder.systemPathFromSplitPath(splitPath);
			expect(result).toBe("root/notes/file.md");
		});

		it("encodes nested md file", () => {
			const splitPath = {
				basename: "Note-Section",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section"],
			} as SplitPathToMdFile;
			const result = pathfinder.systemPathFromSplitPath(splitPath);
			expect(result).toBe("Library/Section/Note-Section.md");
		});

		it("encodes non-md file", () => {
			const splitPath = {
				basename: "image",
				extension: "png",
				kind: SplitPathKind.File,
				pathParts: ["root", "assets"],
			};
			const result = pathfinder.systemPathFromSplitPath(splitPath);
			expect(result).toBe("root/assets/image.png");
		});

		it("encodes folder", () => {
			const splitPath = {
				basename: "Section",
				kind: SplitPathKind.Folder,
				pathParts: ["root", "library"],
			};
			const result = pathfinder.systemPathFromSplitPath(splitPath);
			expect(result).toBe("root/library/Section");
		});

		it("encodes single-segment folder", () => {
			const splitPath = {
				basename: "Library",
				kind: SplitPathKind.Folder,
				pathParts: [],
			};
			const result = pathfinder.systemPathFromSplitPath(splitPath);
			expect(result).toBe("Library");
		});

		it("sanitizes basename with slashes", () => {
			const splitPath = {
				basename: "file/name",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["root"],
			} as SplitPathToMdFile;
			const result = pathfinder.systemPathFromSplitPath(splitPath);
			expect(result).toBe("root/file name.md");
		});

		it("sanitizes basename with backslashes", () => {
			const splitPath = {
				basename: "file\\name",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["root"],
			} as SplitPathToMdFile;
			const result = pathfinder.systemPathFromSplitPath(splitPath);
			expect(result).toBe("root/file name.md");
		});

		it("preserves special characters that Obsidian allows", () => {
			const splitPath = {
				basename: "file-with-!@#$%",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["root"],
			} as SplitPathToMdFile;
			const result = pathfinder.systemPathFromSplitPath(splitPath);
			// Obsidian accepts these characters - they should be preserved
			expect(result).toBe("root/file-with-!@#$%.md");
		});

		it("preserves spaces in basename", () => {
			const splitPath = {
				basename: "file with spaces",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["root"],
			} as SplitPathToMdFile;
			const result = pathfinder.systemPathFromSplitPath(splitPath);
			expect(result).toBe("root/file with spaces.md");
		});

		it("trims basename whitespace", () => {
			const splitPath = {
				basename: "  file  ",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["root"],
			} as SplitPathToMdFile;
			const result = pathfinder.systemPathFromSplitPath(splitPath);
			expect(result).toBe("root/file.md");
		});
	});

	describe("round-trip (encode/decode)", () => {
		it("round-trips root folder", () => {
			const original = pathfinder.SPLIT_PATH_TO_ROOT_FOLDER;
			const encoded = pathfinder.systemPathFromSplitPath(original);
			const decoded = pathfinder.splitPathFromSystemPath(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips md file", () => {
			const original = {
				basename: "file",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["root", "notes"],
			} as SplitPathToMdFile;
			const encoded = pathfinder.systemPathFromSplitPath(original);
			const decoded = pathfinder.splitPathFromSystemPath(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips nested md file", () => {
			const original = {
				basename: "Note-Section",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["Library", "Section", "Subsection"],
			} as SplitPathToMdFile;
			const encoded = pathfinder.systemPathFromSplitPath(original);
			const decoded = pathfinder.splitPathFromSystemPath(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips non-md file", () => {
			const original = {
				basename: "image",
				extension: "png",
				kind: SplitPathKind.File,
				pathParts: ["root", "assets"],
			} as SplitPathToFile;
			const encoded = pathfinder.systemPathFromSplitPath(original);
			const decoded = pathfinder.splitPathFromSystemPath(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips folder", () => {
			const original = {
				basename: "Section",
				kind: SplitPathKind.Folder,
				pathParts: ["root", "library"],
			} as SplitPathToFolder;
			const encoded = pathfinder.systemPathFromSplitPath(original);
			const decoded = pathfinder.splitPathFromSystemPath(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips single-segment folder", () => {
			const original = {
				basename: "Library",
				kind: SplitPathKind.Folder,
				pathParts: [],
			};
			const encoded = pathfinder.systemPathFromSplitPath(original);
			const decoded = pathfinder.splitPathFromSystemPath(encoded);
			expect(decoded).toEqual(original);
		});

		it("round-trips file with dots in basename", () => {
			const original = {
				basename: "file.name",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["root"],
			} as SplitPathToMdFile;
			const encoded = pathfinder.systemPathFromSplitPath(original);
			const decoded = pathfinder.splitPathFromSystemPath(encoded);
			expect(decoded).toEqual(original);
		});
	});

	describe("edge cases", () => {
		it("handles file with only extension", () => {
			const result = pathfinder.splitPathFromSystemPath(".md");
			expect(result).toEqual({
				basename: "",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: [],
			});
		});

		it("handles deeply nested paths", () => {
			const result = pathfinder.splitPathFromSystemPath(
				"a/b/c/d/e/f/g/h/file.md",
			);
			expect(result).toEqual({
				basename: "file",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["a", "b", "c", "d", "e", "f", "g", "h"],
			});
		});

		it("handles unicode characters in path", () => {
			const splitPath = {
				basename: "café",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["répertoire"],
			} as SplitPathToMdFile;
			const encoded = pathfinder.systemPathFromSplitPath(splitPath);
			const decoded = pathfinder.splitPathFromSystemPath(encoded);
			expect(decoded).toEqual(splitPath);
		});

		it("sanitizes path separators in basename", () => {
			const splitPath = {
				basename: "file/name\\with-separators",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["root"],
			} as SplitPathToMdFile;
			const encoded = pathfinder.systemPathFromSplitPath(splitPath);
			// Only path separators (/ and \) are sanitized to spaces
			// Other special chars are preserved (Obsidian's behavior is golden source)
			expect(encoded).toBe("root/file name with-separators.md");
		});

		it("preserves Obsidian-allowed special characters", () => {
			const splitPath = {
				basename: "file!@#$%with-special",
				extension: MD,
				kind: SplitPathKind.MdFile,
				pathParts: ["root"],
			} as SplitPathToMdFile;
			const encoded = pathfinder.systemPathFromSplitPath(splitPath);
			// Obsidian accepts these characters - they should be preserved
			expect(encoded).toBe("root/file!@#$%with-special.md");
		});
	});
});
