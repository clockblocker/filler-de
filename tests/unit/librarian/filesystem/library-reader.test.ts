import { describe, expect, it } from "bun:test";
import { readNoteDtoLegacy } from "../../../../src/commanders/librarian-legacy/filesystem/library-reader";
import { treePathToCodexBasename, treePathToScrollBasename } from "../../../../src/commanders/librarian-legacy/indexing/codecs";
import type { ReadablePrettyFile } from "../../../../src/services/obsidian-services/file-services/background/background-file-service";
import type { TexfresserObsidianServices } from "../../../../src/services/obsidian-services/interface";

const mkReader = (
	basename: string,
	pathParts: string[],
	content = "",
): ReadablePrettyFile => ({
	basename,
	pathParts,
	readContent: async () => content,
});

type BgService = Pick<TexfresserObsidianServices["backgroundFileService"], "getReadersToAllMdFilesInFolder">;

describe("readNoteDtoLegacy", () => {
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

		const notes = await readNoteDtoLegacy(bgService, "Library");

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

		const notes = await readNoteDtoLegacy(bgService, "Library", ["A"]);

		expect(notes).toHaveLength(1);
		expect(notes[0]?.path).toEqual(["A", "One"]);
	});
});
