import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { suffixedBasenameToChainCodec } from "../../../../../src/commanders/librarian/naming/codecs/suffixed-basename-to-chain-codec";
import * as globalState from "../../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../../src/obsidian-vault-action-manager/types/split-path";

const defaultSettings: ParsedUserSettings = {
	apiProvider: "google",
	googleApiKey: "",
	maxSectionDepth: 6,
	splitPathToLibraryRoot: {
		basename: "Library",
		pathParts: [],
		type: SplitPathType.Folder,
	},
	suffixDelimiter: "-",
};

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = spyOn(globalState, "getParsedUserSettings").mockReturnValue({
		...defaultSettings,
	});
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("suffixedBasenameToChainCodec", () => {
	describe("decode (basename → chain)", () => {
		it("decodes library root to empty chain", () => {
			expect(suffixedBasenameToChainCodec.decode("Library")).toEqual([]);
		});

		it("decodes simple section name to single-element chain", () => {
			expect(suffixedBasenameToChainCodec.decode("Section")).toEqual(["Section"]);
		});

		it("decodes suffixed basename to reversed chain", () => {
			expect(suffixedBasenameToChainCodec.decode("Child-Parent")).toEqual([
				"Parent",
				"Child",
			]);
		});

		it("decodes deeply nested suffix", () => {
			expect(suffixedBasenameToChainCodec.decode("A-B-C-D")).toEqual([
				"D",
				"C",
				"B",
				"A",
			]);
		});

		it("decodes file basename with suffix", () => {
			expect(suffixedBasenameToChainCodec.decode("Note-Child-Parent")).toEqual([
				"Parent",
				"Child",
				"Note",
			]);
		});

		it("handles custom delimiter", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				suffixDelimiter: "_",
			});
			expect(suffixedBasenameToChainCodec.decode("A_B_C")).toEqual(["C", "B", "A"]);
		});

		it("handles custom library root", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				splitPathToLibraryRoot: {
					basename: "Root",
					pathParts: [],
					type: SplitPathType.Folder,
				},
			});
			expect(suffixedBasenameToChainCodec.decode("Root")).toEqual([]);
			expect(suffixedBasenameToChainCodec.decode("Library")).toEqual(["Library"]);
		});
	});

	describe("encode (chain → basename)", () => {
		it("encodes empty chain to library root", () => {
			expect(suffixedBasenameToChainCodec.encode([])).toBe("Library");
		});

		it("encodes single-element chain to section name", () => {
			expect(suffixedBasenameToChainCodec.encode(["Section"])).toBe("Section");
		});

		it("encodes chain to suffixed basename", () => {
			expect(suffixedBasenameToChainCodec.encode(["Parent", "Child"])).toBe(
				"Child-Parent",
			);
		});

		it("encodes deeply nested chain", () => {
			expect(suffixedBasenameToChainCodec.encode(["D", "C", "B", "A"])).toBe(
				"A-B-C-D",
			);
		});

		it("encodes file chain with coreName", () => {
			expect(suffixedBasenameToChainCodec.encode(["Parent", "Child", "Note"])).toBe(
				"Note-Child-Parent",
			);
		});

		it("handles custom delimiter", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				suffixDelimiter: "_",
			});
			expect(suffixedBasenameToChainCodec.encode(["C", "B", "A"])).toBe("A_B_C");
		});

		it("handles custom library root", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				splitPathToLibraryRoot: {
					basename: "Root",
					pathParts: [],
					type: SplitPathType.Folder,
				},
			});
			expect(suffixedBasenameToChainCodec.encode([])).toBe("Root");
		});
	});

	describe("roundtrip (encode/decode)", () => {
		it("roundtrips empty chain", () => {
			const chain: string[] = [];
			expect(
				suffixedBasenameToChainCodec.decode(suffixedBasenameToChainCodec.encode(chain)),
			).toEqual(chain);
		});

		it("roundtrips single-element chain", () => {
			const chain = ["Section"];
			expect(
				suffixedBasenameToChainCodec.decode(suffixedBasenameToChainCodec.encode(chain)),
			).toEqual(chain);
		});

		it("roundtrips multi-element chain", () => {
			const chain = ["Parent", "Child", "Note"];
			expect(
				suffixedBasenameToChainCodec.decode(suffixedBasenameToChainCodec.encode(chain)),
			).toEqual(chain);
		});

		it("roundtrips deeply nested chain", () => {
			const chain = ["A", "B", "C", "D", "E"];
			expect(
				suffixedBasenameToChainCodec.decode(suffixedBasenameToChainCodec.encode(chain)),
			).toEqual(chain);
		});
	});
});

