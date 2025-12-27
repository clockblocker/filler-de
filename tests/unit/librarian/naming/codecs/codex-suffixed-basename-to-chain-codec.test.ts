import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { suffixedBasenameForСodexToParentSectionChainCodec } from "../../../../../src/commanders/librarian/naming/deprecated-codexes/suffixed-basename-for-codex-to-chain-codec";
import { CODEX_CORE_NAME } from "../../../../../src/commanders/librarian/types/literals";
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

describe("suffixedBasenameForСodexToParentSectionChainCodec", () => {
	describe("decode (codex basename → parent section chain)", () => {
		it("decodes codex for root section", () => {
			// "__-Library": split to ["__", "Library"], reverse to ["Library", "__"], slice = ["Library"]
			expect(suffixedBasenameForСodexToParentSectionChainCodec.decode("__-Library")).toEqual(
				["Library"],
			);
		});

		it("decodes codex for nested section", () => {
			// "__-Child-Parent": split to ["__", "Child", "Parent"], reverse to ["Parent", "Child", "__"], slice = ["Parent", "Child"]
			expect(
				suffixedBasenameForСodexToParentSectionChainCodec.decode("__-Child-Parent"),
			).toEqual(["Parent", "Child"]);
		});

		it("decodes deeply nested codex", () => {
			// "__-A-B-C-D": split to ["__", "A", "B", "C", "D"], reverse to ["D", "C", "B", "A", "__"], slice = ["D", "C", "B", "A"]
			expect(
				suffixedBasenameForСodexToParentSectionChainCodec.decode("__-A-B-C-D"),
			).toEqual(["D", "C", "B", "A"]);
		});

		it("handles custom delimiter in suffix", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				suffixDelimiter: ";;",
			});
			const result = suffixedBasenameForСodexToParentSectionChainCodec.decode("__;;A;;B;;C");
			expect(result).toEqual(["C", "B", "A"]);
		});

		it("throws for invalid codex basename (no prefix)", () => {
			expect(() => {
				suffixedBasenameForСodexToParentSectionChainCodec.decode("NotCodex");
			}).toThrow();
		});

		it("throws for invalid codex basename (only prefix)", () => {
			expect(() => {
				suffixedBasenameForСodexToParentSectionChainCodec.decode(CODEX_CORE_NAME);
			}).toThrow();
		});
	});

	describe("encode (parent section chain → codex basename)", () => {
		it("encodes empty chain to root codex", () => {
			// Empty chain: encode([CODEX_CORE_NAME]) = "__" (single element, no suffix)
			// But schema requires content after "__", so this should throw
			expect(() => {
				suffixedBasenameForСodexToParentSectionChainCodec.encode([]);
			}).toThrow();
		});

		it("encodes single-element chain", () => {
			// Encode ["Parent", "__"]: last is "__", suffix is reversed ["Parent"] = "Parent", result = "__-Parent"
			expect(suffixedBasenameForСodexToParentSectionChainCodec.encode(["Parent"])).toBe(
				"__-Parent",
			);
		});

		it("encodes multi-element chain", () => {
			// Encode ["Parent", "Child", "__"]: last is "__", suffix is reversed ["Parent", "Child"] = "Child-Parent", result = "__-Child-Parent"
			expect(
				suffixedBasenameForСodexToParentSectionChainCodec.encode(["Parent", "Child"]),
			).toBe("__-Child-Parent");
		});

		it("encodes deeply nested chain", () => {
			// Encode ["D", "C", "B", "A", "__"]: last is "__", suffix is reversed ["D", "C", "B", "A"] = "A-B-C-D", result = "__-A-B-C-D"
			expect(
				suffixedBasenameForСodexToParentSectionChainCodec.encode(["D", "C", "B", "A"]),
			).toBe("__-A-B-C-D");
		});

		it("handles custom delimiter", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				suffixDelimiter: "::",
			});
			expect(
				suffixedBasenameForСodexToParentSectionChainCodec.encode(["C", "B", "A"]),
			).toBe("__::A::B::C");
		});
	});

	describe("roundtrip (encode/decode)", () => {
		it("roundtrips empty chain", () => {
			// Empty chain can't be encoded (violates schema)
			expect(() => {
				suffixedBasenameForСodexToParentSectionChainCodec.encode([]);
			}).toThrow();
		});

		it("roundtrips single-element chain", () => {
			const chain = ["Parent"];
			expect(
				suffixedBasenameForСodexToParentSectionChainCodec.decode(
					suffixedBasenameForСodexToParentSectionChainCodec.encode(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips multi-element chain", () => {
			const chain = ["Parent", "Child"];
			expect(
				suffixedBasenameForСodexToParentSectionChainCodec.decode(
					suffixedBasenameForСodexToParentSectionChainCodec.encode(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips deeply nested chain", () => {
			const chain = ["A", "B", "C", "D"];
			expect(
				suffixedBasenameForСodexToParentSectionChainCodec.decode(
					suffixedBasenameForСodexToParentSectionChainCodec.encode(chain),
				),
			).toEqual(chain);
		});
	});
});

