import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec,
	pathPartsToNodeNameChainCodec,
	separatedCanonicalBasenameToNodeNameChainCodec,
} from "../../../../../src/commanders/librarian/naming/codecs/chain-codecs";
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

describe("pathPartsToNodeNameChainCodec", () => {
	describe("decode (pathParts → chain)", () => {
		it("decodes pathParts with library root to chain without root", () => {
			expect(pathPartsToNodeNameChainCodec.decode(["Library", "parent", "child"])).toEqual([
				"parent",
				"child",
			]);
		});

		it("decodes pathParts with only library root to empty chain", () => {
			expect(pathPartsToNodeNameChainCodec.decode(["Library"])).toEqual([]);
		});

		it("decodes empty pathParts to empty chain", () => {
			expect(pathPartsToNodeNameChainCodec.decode([])).toEqual([]);
		});

		it("decodes deeply nested pathParts", () => {
			expect(
				pathPartsToNodeNameChainCodec.decode(["Library", "A", "B", "C", "D"]),
			).toEqual(["A", "B", "C", "D"]);
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
			expect(pathPartsToNodeNameChainCodec.decode(["Root", "parent", "child"])).toEqual([
				"parent",
				"child",
			]);
		});
	});

	describe("encode (chain → pathParts)", () => {
		it("encodes chain to pathParts with library root", () => {
			expect(pathPartsToNodeNameChainCodec.encode(["parent", "child"])).toEqual([
				"Library",
				"parent",
				"child",
			]);
		});

		it("encodes empty chain to pathParts with only library root", () => {
			expect(pathPartsToNodeNameChainCodec.encode([])).toEqual(["Library"]);
		});

		it("encodes deeply nested chain", () => {
			expect(pathPartsToNodeNameChainCodec.encode(["A", "B", "C", "D"])).toEqual([
				"Library",
				"A",
				"B",
				"C",
				"D",
			]);
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
			expect(pathPartsToNodeNameChainCodec.encode(["parent", "child"])).toEqual([
				"Root",
				"parent",
				"child",
			]);
		});
	});

	describe("roundtrip (encode/decode)", () => {
		it("roundtrips empty chain", () => {
			const chain: string[] = [];
			expect(
				pathPartsToNodeNameChainCodec.decode(
					pathPartsToNodeNameChainCodec.encode(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips single-element chain", () => {
			const chain = ["parent"];
			expect(
				pathPartsToNodeNameChainCodec.decode(
					pathPartsToNodeNameChainCodec.encode(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips multi-element chain", () => {
			const chain = ["parent", "child", "grandchild"];
			expect(
				pathPartsToNodeNameChainCodec.decode(
					pathPartsToNodeNameChainCodec.encode(chain),
				),
			).toEqual(chain);
		});
	});
});

describe("separatedCanonicalBasenameToNodeNameChainCodec", () => {
	describe("encode (chain → separatedCanonicalBasename)", () => {
		it("encodes single-element chain", () => {
			expect(separatedCanonicalBasenameToNodeNameChainCodec.encode(["child"])).toEqual({
				nodeName: "child",
				splitSuffix: [],
			});
		});

		it("encodes two-element chain", () => {
			expect(separatedCanonicalBasenameToNodeNameChainCodec.encode(["parent", "child"])).toEqual({
				nodeName: "child",
				splitSuffix: ["parent"],
			});
		});

		it("encodes multi-element chain", () => {
			expect(
				separatedCanonicalBasenameToNodeNameChainCodec.encode(["grandparent", "parent", "child"]),
			).toEqual({
				nodeName: "child",
				splitSuffix: ["grandparent", "parent"],
			});
		});

		it("encodes deeply nested chain", () => {
			expect(
				separatedCanonicalBasenameToNodeNameChainCodec.encode(["A", "B", "C", "D", "E"]),
			).toEqual({
				nodeName: "E",
				splitSuffix: ["A", "B", "C", "D"],
			});
		});

		it("encodes empty chain", () => {
			expect(separatedCanonicalBasenameToNodeNameChainCodec.encode([])).toEqual({
				nodeName: "",
				splitSuffix: [],
			});
		});
	});

	describe("decode (separatedCanonicalBasename → chain)", () => {
		it("decodes separatedCanonicalBasename with no suffix", () => {
			expect(
				separatedCanonicalBasenameToNodeNameChainCodec.decode({
					nodeName: "child",
					splitSuffix: [],
				}),
			).toEqual(["child"]);
		});

		it("decodes separatedCanonicalBasename with single suffix", () => {
			expect(
				separatedCanonicalBasenameToNodeNameChainCodec.decode({
					nodeName: "child",
					splitSuffix: ["parent"],
				}),
			).toEqual(["parent", "child"]);
		});

		it("decodes separatedCanonicalBasename with multiple suffixes", () => {
			expect(
				separatedCanonicalBasenameToNodeNameChainCodec.decode({
					nodeName: "child",
					splitSuffix: ["grandparent", "parent"],
				}),
			).toEqual(["grandparent", "parent", "child"]);
		});

		it("decodes deeply nested separatedCanonicalBasename", () => {
			expect(
				separatedCanonicalBasenameToNodeNameChainCodec.decode({
					nodeName: "E",
					splitSuffix: ["A", "B", "C", "D"],
				}),
			).toEqual(["A", "B", "C", "D", "E"]);
		});

		it("decodes separatedCanonicalBasename with empty nodeName", () => {
			expect(
				separatedCanonicalBasenameToNodeNameChainCodec.decode({
					nodeName: "",
					splitSuffix: [],
				}),
			).toEqual([""]);
		});
	});

	describe("roundtrip (encode/decode)", () => {
		it("roundtrips single-element chain", () => {
			const chain = ["child"];
			expect(
				separatedCanonicalBasenameToNodeNameChainCodec.decode(
					separatedCanonicalBasenameToNodeNameChainCodec.encode(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips two-element chain", () => {
			const chain = ["parent", "child"];
			expect(
				separatedCanonicalBasenameToNodeNameChainCodec.decode(
					separatedCanonicalBasenameToNodeNameChainCodec.encode(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips multi-element chain", () => {
			const chain = ["grandparent", "parent", "child"];
			expect(
				separatedCanonicalBasenameToNodeNameChainCodec.decode(
					separatedCanonicalBasenameToNodeNameChainCodec.encode(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips deeply nested chain", () => {
			const chain = ["A", "B", "C", "D", "E"];
			expect(
				separatedCanonicalBasenameToNodeNameChainCodec.decode(
					separatedCanonicalBasenameToNodeNameChainCodec.encode(chain),
				),
			).toEqual(chain);
		});
	});
});

describe("canonicalBasenameToSeparatedCanonicalBasenameCodec", () => {
	describe("encode (separatedCanonicalBasename → canonicalBasename)", () => {
		it("encodes separatedCanonicalBasename with no suffix", () => {
			expect(
				joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.encode({
					nodeName: "NoteName",
					splitSuffix: [],
				}),
			).toBe("NoteName");
		});

		it("encodes separatedCanonicalBasename with single suffix", () => {
			expect(
				joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.encode({
					nodeName: "NoteName",
					splitSuffix: ["child"],
				}),
			).toBe("NoteName-child");
		});

		it("encodes separatedCanonicalBasename with multiple suffixes", () => {
			expect(
				joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.encode({
					nodeName: "NoteName",
					splitSuffix: ["child", "parent"],
				}),
			).toBe("NoteName-child-parent");
		});

		it("encodes deeply nested separatedCanonicalBasename", () => {
			expect(
				joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.encode({
					nodeName: "NoteName",
					splitSuffix: ["A", "B", "C", "D"],
				}),
			).toBe("NoteName-A-B-C-D");
		});

		it("encodes codex basename", () => {
			expect(
				joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.encode({
					nodeName: "__",
					splitSuffix: ["child", "parent"],
				}),
			).toBe("__-child-parent");
		});
	});

	describe("decode (canonicalBasename → separatedCanonicalBasename)", () => {
		it("decodes canonicalBasename with no suffix", () => {
			expect(joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.decode("NoteName")).toEqual({
				nodeName: "NoteName",
				splitSuffix: [],
			});
		});

		it("decodes canonicalBasename with single suffix", () => {
			expect(joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.decode("NoteName-child")).toEqual({
				nodeName: "NoteName",
				splitSuffix: ["child"],
			});
		});

		it("decodes canonicalBasename with multiple suffixes", () => {
			expect(
				joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.decode("NoteName-child-parent"),
			).toEqual({
				nodeName: "NoteName",
				splitSuffix: ["child", "parent"],
			});
		});

		it("decodes deeply nested canonicalBasename", () => {
			expect(joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.decode("NoteName-A-B-C-D")).toEqual({
				nodeName: "NoteName",
				splitSuffix: ["A", "B", "C", "D"],
			});
		});

		it("decodes codex basename", () => {
			expect(joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.decode("__-child-parent")).toEqual({
				nodeName: "__",
				splitSuffix: ["child", "parent"],
			});
		});

		it("handles custom delimiter", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				suffixDelimiter: "_",
			});
			expect(joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.decode("NoteName_A_B")).toEqual({
				nodeName: "NoteName",
				splitSuffix: ["A", "B"],
			});
		});
	});

	describe("roundtrip (encode/decode)", () => {
		it("roundtrips separatedCanonicalBasename with no suffix", () => {
			const parsed = { nodeName: "NoteName", splitSuffix: [] };
			expect(
				joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.decode(
					joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.encode(parsed),
				),
			).toEqual(parsed);
		});

		it("roundtrips separatedCanonicalBasename with single suffix", () => {
			const parsed = { nodeName: "NoteName", splitSuffix: ["child"] };
			expect(
				joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.decode(
					joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.encode(parsed),
				),
			).toEqual(parsed);
		});

		it("roundtrips separatedCanonicalBasename with multiple suffixes", () => {
			const parsed = { nodeName: "NoteName", splitSuffix: ["child", "parent"] };
			expect(
				joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.decode(
					joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.encode(parsed),
				),
			).toEqual(parsed);
		});

		it("roundtrips deeply nested separatedCanonicalBasename", () => {
			const parsed = { nodeName: "NoteName", splitSuffix: ["A", "B", "C", "D"] };
			expect(
				joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.decode(
					joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.encode(parsed),
				),
			).toEqual(parsed);
		});

		it("roundtrips codex basename", () => {
			const parsed = { nodeName: "__", splitSuffix: ["child", "parent"] };
			expect(
				joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.decode(
					joinedCanonicalBasenameToSeparatedCanonicalBasenameCodec.encode(parsed),
				),
			).toEqual(parsed);
		});
	});
});

