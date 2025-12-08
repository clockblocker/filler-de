import { describe, expect, it } from "bun:test";
import { LibraryReader } from "../../../src/commanders/librarian/filesystem/library-reader";
import { treePathToCodexBasename, treePathToScrollBasename } from "../../../src/commanders/librarian/indexing/codecs";
import type { ReadablePrettyFile } from "../../../src/services/obsidian-services/file-services/background/background-file-service";
import type { TexfresserObsidianServices } from "../../../src/services/obsidian-services/interface";

const mkReader = (
	basename: string,
	pathParts: string[],
	content = "",
): ReadablePrettyFile => ({
	basename,
	pathParts,
	readContent: async () => content,
});

describe("LibraryReader", () => {
	it("filters untracked and codex files, keeps tracked notes", async () => {
		const backgroundFileService = {
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
		} satisfies Pick<TexfresserObsidianServices["backgroundFileService"], "getReadersToAllMdFilesInFolder">;

		const reader = new LibraryReader(backgroundFileService);
		const notes = await reader.readNoteDtos("Library");

		expect(notes).toHaveLength(1);
		expect(notes[0]?.path).toEqual(["Section", "Note"]);
	});

	it("supports subtree filtering", async () => {
		const backgroundFileService = {
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
		} satisfies Pick<TexfresserObsidianServices["backgroundFileService"], "getReadersToAllMdFilesInFolder">;

		const reader = new LibraryReader(backgroundFileService);
		const notes = await reader.readNoteDtos("Library", ["A"]);

		expect(notes).toHaveLength(1);
		expect(notes[0]?.path).toEqual(["A", "One"]);
	});
});
