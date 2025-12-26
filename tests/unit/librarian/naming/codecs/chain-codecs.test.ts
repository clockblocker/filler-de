import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename,
	makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename,
} from "../../../../../src/commanders/librarian/naming/atomic/joined-canonical-basename-and-separated-canonical-basename";
import {
	makeNodeNameChainFromPathParts,
	makePathPartsFromNodeNameChain,
} from "../../../../../src/commanders/librarian/naming/atomic/path-parts-and-node-name-chain";
import {
	makeNodeNameChainFromSeparatedCanonicalBasename,
	makeSeparatedCanonicalBasenameFromNodeNameChain,
} from "../../../../../src/commanders/librarian/naming/atomic/separated-canonical-basename-and-node-name-chain";
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
			expect(makeNodeNameChainFromPathParts(["Library", "parent", "child"])).toEqual([
				"parent",
				"child",
			]);
		});

		it("decodes pathParts with only library root to empty chain", () => {
			expect(makeNodeNameChainFromPathParts(["Library"])).toEqual([]);
		});

		it("decodes empty pathParts to empty chain", () => {
			expect(makeNodeNameChainFromPathParts([])).toEqual([]);
		});

		it("decodes deeply nested pathParts", () => {
			expect(makeNodeNameChainFromPathParts(["Library", "A", "B", "C", "D"])).toEqual([
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
			expect(makeNodeNameChainFromPathParts(["Root", "parent", "child"])).toEqual([
				"parent",
				"child",
			]);
		});
	});

	describe("encode (chain → pathParts)", () => {
		it("encodes chain to pathParts with library root", () => {
			expect(makePathPartsFromNodeNameChain(["parent", "child"])).toEqual([
				"Library",
				"parent",
				"child",
			]);
		});

		it("encodes empty chain to pathParts with only library root", () => {
			expect(makePathPartsFromNodeNameChain([])).toEqual(["Library"]);
		});

		it("encodes deeply nested chain", () => {
			expect(makePathPartsFromNodeNameChain(["A", "B", "C", "D"])).toEqual([
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
			expect(makePathPartsFromNodeNameChain(["parent", "child"])).toEqual([
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
				makeNodeNameChainFromPathParts(
					makePathPartsFromNodeNameChain(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips single-element chain", () => {
			const chain = ["parent"];
			expect(
				makeNodeNameChainFromPathParts(
					makePathPartsFromNodeNameChain(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips multi-element chain", () => {
			const chain = ["parent", "child", "grandchild"];
			expect(
				makeNodeNameChainFromPathParts(
					makePathPartsFromNodeNameChain(chain),
				),
			).toEqual(chain);
		});
	});
});

describe("separatedCanonicalBasenameToNodeNameChainCodec", () => {
	describe("encode (chain → separatedCanonicalBasename)", () => {
		it("encodes single-element chain", () => {
			expect(makeSeparatedCanonicalBasenameFromNodeNameChain(["child"])).toEqual({
				nodeName: "child",
				splitSuffix: [],
			});
		});

		it("encodes two-element chain", () => {
			expect(makeSeparatedCanonicalBasenameFromNodeNameChain(["parent", "child"])).toEqual({
				nodeName: "child",
				splitSuffix: ["parent"],
			});
		});

		it("encodes multi-element chain", () => {
			expect(
				makeSeparatedCanonicalBasenameFromNodeNameChain(["grandparent", "parent", "child"]),
			).toEqual({
				nodeName: "child",
				splitSuffix: ["grandparent", "parent"],
			});
		});

		it("encodes deeply nested chain", () => {
			expect(makeSeparatedCanonicalBasenameFromNodeNameChain(["A", "B", "C", "D", "E"])).toEqual({
				nodeName: "E",
				splitSuffix: ["A", "B", "C", "D"],
			});
		});

		it("encodes empty chain", () => {
			expect(makeSeparatedCanonicalBasenameFromNodeNameChain([])).toEqual({
				nodeName: "",
				splitSuffix: [],
			});
		});
	});

	describe("decode (separatedCanonicalBasename → chain)", () => {
		it("decodes separatedCanonicalBasename with no suffix", () => {
			expect(
				makeNodeNameChainFromSeparatedCanonicalBasename({
					nodeName: "child",
					splitSuffix: [],
				}),
			).toEqual(["child"]);
		});

		it("decodes separatedCanonicalBasename with single suffix", () => {
			expect(
				makeNodeNameChainFromSeparatedCanonicalBasename({
					nodeName: "child",
					splitSuffix: ["parent"],
				}),
			).toEqual(["parent", "child"]);
		});

		it("decodes separatedCanonicalBasename with multiple suffixes", () => {
			expect(
				makeNodeNameChainFromSeparatedCanonicalBasename({
					nodeName: "child",
					splitSuffix: ["grandparent", "parent"],
				}),
			).toEqual(["grandparent", "parent", "child"]);
		});

		it("decodes deeply nested separatedCanonicalBasename", () => {
			expect(
				makeNodeNameChainFromSeparatedCanonicalBasename({
					nodeName: "E",
					splitSuffix: ["A", "B", "C", "D"],
				}),
			).toEqual(["A", "B", "C", "D", "E"]);
		});

		it("decodes separatedCanonicalBasename with empty nodeName", () => {
			expect(
				makeNodeNameChainFromSeparatedCanonicalBasename({
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
				makeNodeNameChainFromSeparatedCanonicalBasename(
					makeSeparatedCanonicalBasenameFromNodeNameChain(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips two-element chain", () => {
			const chain = ["parent", "child"];
			expect(
				makeNodeNameChainFromSeparatedCanonicalBasename(
					makeSeparatedCanonicalBasenameFromNodeNameChain(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips multi-element chain", () => {
			const chain = ["grandparent", "parent", "child"];
			expect(
				makeNodeNameChainFromSeparatedCanonicalBasename(
					makeSeparatedCanonicalBasenameFromNodeNameChain(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips deeply nested chain", () => {
			const chain = ["A", "B", "C", "D", "E"];
			expect(
				makeNodeNameChainFromSeparatedCanonicalBasename(
					makeSeparatedCanonicalBasenameFromNodeNameChain(chain),
				),
			).toEqual(chain);
		});
	});
});

describe("canonicalBasenameToSeparatedCanonicalBasenameCodec", () => {
	describe("encode (separatedCanonicalBasename → canonicalBasename)", () => {
		it("encodes separatedCanonicalBasename with no suffix", () => {
			expect(
				makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename({
					nodeName: "NoteName",
					splitSuffix: [],
				}),
			).toBe("NoteName");
		});

		it("encodes separatedCanonicalBasename with single suffix", () => {
			expect(
				makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename({
					nodeName: "NoteName",
					splitSuffix: ["child"],
				}),
			).toBe("NoteName-child");
		});

		it("encodes separatedCanonicalBasename with multiple suffixes", () => {
			expect(
				makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename({
					nodeName: "NoteName",
					splitSuffix: ["child", "parent"],
				}),
			).toBe("NoteName-child-parent");
		});

		it("encodes deeply nested separatedCanonicalBasename", () => {
			expect(
				makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename({
					nodeName: "NoteName",
					splitSuffix: ["A", "B", "C", "D"],
				}),
			).toBe("NoteName-A-B-C-D");
		});

		it("encodes codex basename", () => {
			expect(
				makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename({
					nodeName: "__",
					splitSuffix: ["child", "parent"],
				}),
			).toBe("__-child-parent");
		});
	});

	describe("decode (canonicalBasename → separatedCanonicalBasename)", () => {
		it("decodes canonicalBasename with no suffix", () => {
			expect(makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename("NoteName")).toEqual({
				nodeName: "NoteName",
				splitSuffix: [],
			});
		});

		it("decodes canonicalBasename with single suffix", () => {
			expect(makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename("NoteName-child")).toEqual({
				nodeName: "NoteName",
				splitSuffix: ["child"],
			});
		});

		it("decodes canonicalBasename with multiple suffixes", () => {
			expect(
				makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename("NoteName-child-parent"),
			).toEqual({
				nodeName: "NoteName",
				splitSuffix: ["child", "parent"],
			});
		});

		it("decodes deeply nested canonicalBasename", () => {
			expect(makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename("NoteName-A-B-C-D")).toEqual({
				nodeName: "NoteName",
				splitSuffix: ["A", "B", "C", "D"],
			});
		});

		it("decodes codex basename", () => {
			expect(makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename("__-child-parent")).toEqual({
				nodeName: "__",
				splitSuffix: ["child", "parent"],
			});
		});

		it("handles custom delimiter", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				suffixDelimiter: "_",
			});
			expect(makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename("NoteName_A_B")).toEqual({
				nodeName: "NoteName",
				splitSuffix: ["A", "B"],
			});
		});
	});

	describe("roundtrip (encode/decode)", () => {
		it("roundtrips separatedCanonicalBasename with no suffix", () => {
			const parsed = { nodeName: "NoteName", splitSuffix: [] };
			expect(
				makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename(
					makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename(parsed),
				),
			).toEqual(parsed);
		});

		it("roundtrips separatedCanonicalBasename with single suffix", () => {
			const parsed = { nodeName: "NoteName", splitSuffix: ["child"] };
			expect(
				makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename(
					makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename(parsed),
				),
			).toEqual(parsed);
		});

		it("roundtrips separatedCanonicalBasename with multiple suffixes", () => {
			const parsed = { nodeName: "NoteName", splitSuffix: ["child", "parent"] };
			expect(
				makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename(
					makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename(parsed),
				),
			).toEqual(parsed);
		});

		it("roundtrips deeply nested separatedCanonicalBasename", () => {
			const parsed = { nodeName: "NoteName", splitSuffix: ["A", "B", "C", "D"] };
			expect(
				makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename(
					makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename(parsed),
				),
			).toEqual(parsed);
		});

		it("roundtrips codex basename", () => {
			const parsed = { nodeName: "__", splitSuffix: ["child", "parent"] };
			expect(
				makeSeparatedCanonicalBasenameFromJoinedCanonicalBasename(
					makeJoinedCanonicalBasenameFromSeparatedCanonicalBasename(parsed),
				),
			).toEqual(parsed);
		});
	});
});

