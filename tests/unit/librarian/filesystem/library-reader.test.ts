import { describe, expect, it } from "bun:test";
import { readNoteDtos } from "../../../../src/commanders/librarian/filesystem/library-reader";
import { treePathToCodexBasename, treePathToScrollBasename } from "../../../../src/commanders/librarian/indexing/codecs";
import type {
	SplitPathToMdFile,
} from "../../../../src/obsidian-vault-action-manager/types/split-path";

const mkReader = (
	basename: string,
	pathParts: string[],
	content = "",
): SplitPathToMdFile & { readContent: () => Promise<string> } => ({
	basename,
	extension: "md",
	pathParts,
	readContent: async () => content,
	type: "MdFile",
});

type BgService = {
	getReadersToAllMdFilesInFolder: (
		folder: { basename: string; pathParts: string[]; type: "Folder" },
	) => Promise<Array<SplitPathToMdFile & { readContent: () => Promise<string> }>>;
};

describe("readNoteDtos", () => {
	it("filters untracked and codex files, keeps tracked notes", async () => {
		const bgService: BgService = {
			getReadersToAllMdFilesInFolder: async () => [
				// tracked scroll (no meta; inferred)
				mkReader(
					treePathToScrollBasename.encode(["Section", "Note"]),
					["Library", "Section"],
				),
				// codex should be ignored by noteDtos
				mkReader(
					treePathToCodexBasename.encode(["Section"]),
					["Library", "Section"],
				),
				// untracked file should be filtered before note mapping
				mkReader(
					treePathToScrollBasename.encode(["Untracked", "Ignored"]),
					["Library", "Untracked"],
				),
			],
		};

		const notes = await readNoteDtos(bgService, "Library");

		expect(notes).toHaveLength(1);
		expect(notes[0]?.path).toEqual(["Section", "Note"]);
	});

	it("supports subtree filtering", async () => {
		const bgService: BgService = {
			getReadersToAllMdFilesInFolder: async () => [
				mkReader(
					treePathToScrollBasename.encode(["A", "One"]),
					["Library", "A"],
				),
				mkReader(
					treePathToScrollBasename.encode(["B", "Two"]),
					["Library", "B"],
				),
			],
		};

		const notes = await readNoteDtos(bgService, "Library", ["A"]);

		expect(notes).toHaveLength(1);
		expect(notes[0]?.path).toEqual(["A", "One"]);
	});
});
