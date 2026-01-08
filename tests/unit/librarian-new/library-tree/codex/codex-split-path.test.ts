import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import type { SectionNodeSegmentId } from "../../../../../src/commanders/librarian-new/library-tree/tree-node/types/node-segment-id";
import { computeCodexSplitPath } from "../../../../../src/commanders/librarian-new/library-tree/codex/codex-split-path";
import { SplitPathType } from "../../../../../src/obsidian-vault-action-manager/types/split-path";
import * as globalState from "../../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../../src/global-state/parsed-settings";

const defaultSettings: ParsedUserSettings = {
	apiProvider: "google",
	googleApiKey: "",
	maxSectionDepth: 6,
	showScrollsInCodexesForDepth: 0,
	splitPathToLibraryRoot: {
		basename: "Library",
		pathParts: [],
		type: SplitPathType.Folder,
	},
	suffixDelimiter: "-",
};

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = spyOn(
		globalState,
		"getParsedUserSettings",
	).mockReturnValue({ ...defaultSettings });
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

// Helper to create segment IDs for tests
const sec = (name: string): SectionNodeSegmentId =>
	`${name}﹘Section﹘` as SectionNodeSegmentId;

describe("computeCodexSplitPath", () => {
	it("root library codex → Library/__", () => {
		const chain = [sec("Library")];
		const result = computeCodexSplitPath(chain);

		expect(result).toEqual({
			type: SplitPathType.MdFile,
			pathParts: ["Library"],
			basename: "__",
			extension: "md",
		});
	});

	it("first-level section → Library/A/__-A", () => {
		const chain = [sec("Library"), sec("A")];
		const result = computeCodexSplitPath(chain);

		expect(result).toEqual({
			type: SplitPathType.MdFile,
			pathParts: ["Library", "A"],
			basename: "__-A",
			extension: "md",
		});
	});

	it("nested section → Library/A/B/__-B-A", () => {
		const chain = [sec("Library"), sec("A"), sec("B")];
		const result = computeCodexSplitPath(chain);

		expect(result).toEqual({
			type: SplitPathType.MdFile,
			pathParts: ["Library", "A", "B"],
			basename: "__-B-A",
			extension: "md",
		});
	});

	it("deeply nested → Library/A/B/C/__-C-B-A", () => {
		const chain = [sec("Library"), sec("A"), sec("B"), sec("C")];
		const result = computeCodexSplitPath(chain);

		expect(result).toEqual({
			type: SplitPathType.MdFile,
			pathParts: ["Library", "A", "B", "C"],
			basename: "__-C-B-A",
			extension: "md",
		});
	});

	it("throws on empty chain", () => {
		expect(() => computeCodexSplitPath([])).toThrow();
	});
});
