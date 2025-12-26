import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { canonicalBasenameToChainCodec } from "../../../../../src/commanders/librarian/naming/codecs/suffixed-basename-to-chain-codec";
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

describe("canonicalBasenameToChainCodec", () => {
	describe("decode (basename → chain)", () => {
		it("decodes library root to empty chain", () => {
			expect(canonicalBasenameToChainCodec.decode("Library")).toEqual([]);
		});

		it("decodes simple section name to single-element chain", () => {
			expect(canonicalBasenameToChainCodec.decode("Section")).toEqual(["Section"]);
		});

		it("decodes suffixed basename to reversed chain", () => {
			expect(canonicalBasenameToChainCodec.decode("Child-Parent")).toEqual([
				"Parent",
				"Child",
			]);
		});

		it("decodes deeply nested suffix", () => {
			expect(canonicalBasenameToChainCodec.decode("A-B-C-D")).toEqual([
				"D",
				"C",
				"B",
				"A",
			]);
		});

		it("decodes file basename with suffix", () => {
			expect(canonicalBasenameToChainCodec.decode("Note-Child-Parent")).toEqual([
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
			expect(canonicalBasenameToChainCodec.decode("A_B_C")).toEqual(["C", "B", "A"]);
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
			expect(canonicalBasenameToChainCodec.decode("Root")).toEqual([]);
			expect(canonicalBasenameToChainCodec.decode("Library")).toEqual(["Library"]);
		});
	});

	describe("encode (chain → basename)", () => {
		it("encodes empty chain to library root", () => {
			expect(canonicalBasenameToChainCodec.encode([])).toBe("Library");
		});

		it("encodes single-element chain to section name", () => {
			expect(canonicalBasenameToChainCodec.encode(["Section"])).toBe("Section");
		});

		it("encodes chain to suffixed basename", () => {
			expect(canonicalBasenameToChainCodec.encode(["Parent", "Child"])).toBe(
				"Child-Parent",
			);
		});

		it("encodes deeply nested chain", () => {
			expect(canonicalBasenameToChainCodec.encode(["D", "C", "B", "A"])).toBe(
				"A-B-C-D",
			);
		});

		it("encodes file chain with nodeName", () => {
			expect(canonicalBasenameToChainCodec.encode(["Parent", "Child", "Note"])).toBe(
				"Note-Child-Parent",
			);
		});

		it("handles custom delimiter", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				suffixDelimiter: "_",
			});
			expect(canonicalBasenameToChainCodec.encode(["C", "B", "A"])).toBe("A_B_C");
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
			expect(canonicalBasenameToChainCodec.encode([])).toBe("Root");
		});
	});

	describe("roundtrip (encode/decode)", () => {
		it("roundtrips empty chain", () => {
			const chain: string[] = [];
			expect(
				canonicalBasenameToChainCodec.decode(canonicalBasenameToChainCodec.encode(chain)),
			).toEqual(chain);
		});

		it("roundtrips single-element chain", () => {
			const chain = ["Section"];
			expect(
				canonicalBasenameToChainCodec.decode(canonicalBasenameToChainCodec.encode(chain)),
			).toEqual(chain);
		});

		it("roundtrips multi-element chain", () => {
			const chain = ["Parent", "Child", "Note"];
			expect(
				canonicalBasenameToChainCodec.decode(canonicalBasenameToChainCodec.encode(chain)),
			).toEqual(chain);
		});

		it("roundtrips deeply nested chain", () => {
			const chain = ["A", "B", "C", "D", "E"];
			expect(
				canonicalBasenameToChainCodec.decode(canonicalBasenameToChainCodec.encode(chain)),
			).toEqual(chain);
		});
	});
});

