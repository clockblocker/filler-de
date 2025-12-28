import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import z from "zod";
import  { makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename, makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename } from "../../../../../src/commanders/librarian/naming/codecs/atomic/joined-canonical-basename-and-separated-canonical-basename";
import  { makeNodeNameChainFromPathParts, makePathPartsFromNodeNameChain } from "../../../../../src/commanders/librarian/naming/codecs/atomic/path-parts-and-node-name-chain";
import  { makeNodeNameChainFromSeparatedSuffixedBasename, makeSeparatedSuffixedBasenameFromNodeNameChain } from "../../../../../src/commanders/librarian/naming/codecs/atomic/separated-canonical-basename-and-node-name-chain";
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

describe("separatedSuffixedBasenameToNodeNameChainCodec", () => {
	describe("encode (chain → separatedSuffixedBasename)", () => {
		it("encodes single-element chain", () => {
			expect(makeSeparatedSuffixedBasenameFromNodeNameChain(["child"])).toEqual({
				nodeName: "child",
				splitSuffix: [],
			});
		});

		it("encodes two-element chain (suffix is reversed)", () => {
			expect(makeSeparatedSuffixedBasenameFromNodeNameChain(["parent", "child"])).toEqual({
				nodeName: "child",
				splitSuffix: ["parent"],
			});
		});

		it("encodes multi-element chain (suffix is reversed)", () => {
			expect(
				makeSeparatedSuffixedBasenameFromNodeNameChain(["grandparent", "parent", "child"]),
			).toEqual({
				nodeName: "child",
				splitSuffix: ["parent", "grandparent"],
			});
		});

		it("encodes deeply nested chain (suffix is reversed)", () => {
			expect(makeSeparatedSuffixedBasenameFromNodeNameChain(["A", "B", "C", "D", "E"])).toEqual({
				nodeName: "E",
				splitSuffix: ["D", "C", "B", "A"],
			});
		});

		it("encodes empty chain", () => {
			try {
				makeSeparatedSuffixedBasenameFromNodeNameChain([]);
				expect(false).toBe(true); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(z.ZodError);
				if (error instanceof z.ZodError) {
					expect(error.issues.some((issue) => issue.message === "EmptyNodeName")).toBe(true);
				}
			}
		});
	});

	describe("decode (separatedSuffixedBasename → chain)", () => {
		it("decodes separatedSuffixedBasename with no suffix", () => {
			expect(
				makeNodeNameChainFromSeparatedSuffixedBasename({
					nodeName: "child",
					splitSuffix: [],
				}),
			).toEqual(["child"]);
		});

		it("decodes separatedSuffixedBasename with single suffix (reverses back)", () => {
			expect(
				makeNodeNameChainFromSeparatedSuffixedBasename({
					nodeName: "child",
					splitSuffix: ["parent"],
				}),
			).toEqual(["parent", "child"]);
		});

		it("decodes separatedSuffixedBasename with multiple suffixes (reverses back)", () => {
			expect(
				makeNodeNameChainFromSeparatedSuffixedBasename({
					nodeName: "child",
					splitSuffix: ["parent", "grandparent"],
				}),
			).toEqual(["grandparent", "parent", "child"]);
		});

		it("decodes deeply nested separatedSuffixedBasename (reverses back)", () => {
			expect(
				makeNodeNameChainFromSeparatedSuffixedBasename({
					nodeName: "E",
					splitSuffix: ["D", "C", "B", "A"],
				}),
			).toEqual(["A", "B", "C", "D", "E"]);
		});

		it("decodes separatedSuffixedBasename with empty nodeName", () => {
			try {
				makeNodeNameChainFromSeparatedSuffixedBasename({
					nodeName: "",
					splitSuffix: [],
				});
				expect(false).toBe(true); // Should not reach here
			} catch (error) {
				expect(error).toBeInstanceOf(z.ZodError);
				if (error instanceof z.ZodError) {
					expect(error.issues.some((issue) => issue.message === "EmptyNodeName")).toBe(true);
				}
			}
		});
	});

	describe("roundtrip (encode/decode)", () => {
		it("roundtrips single-element chain", () => {
			const chain = ["child"];
			expect(
				makeNodeNameChainFromSeparatedSuffixedBasename(
					makeSeparatedSuffixedBasenameFromNodeNameChain(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips two-element chain", () => {
			const chain = ["parent", "child"];
			expect(
				makeNodeNameChainFromSeparatedSuffixedBasename(
					makeSeparatedSuffixedBasenameFromNodeNameChain(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips multi-element chain", () => {
			const chain = ["grandparent", "parent", "child"];
			expect(
				makeNodeNameChainFromSeparatedSuffixedBasename(
					makeSeparatedSuffixedBasenameFromNodeNameChain(chain),
				),
			).toEqual(chain);
		});

		it("roundtrips deeply nested chain", () => {
			const chain = ["A", "B", "C", "D", "E"];
			expect(
				makeNodeNameChainFromSeparatedSuffixedBasename(
					makeSeparatedSuffixedBasenameFromNodeNameChain(chain),
				),
			).toEqual(chain);
		});
	});
});

describe("canonicalBasenameToSeparatedSuffixedBasenameCodec", () => {
	describe("encode (separatedSuffixedBasename → canonicalBasename)", () => {
		it("encodes separatedSuffixedBasename with no suffix", () => {
			expect(
				makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename({
					nodeName: "NoteName",
					splitSuffix: [],
				}),
			).toBe("NoteName");
		});

		it("encodes separatedSuffixedBasename with single suffix", () => {
			expect(
				makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename({
					nodeName: "NoteName",
					splitSuffix: ["child"],
				}),
			).toBe("NoteName-child");
		});

		it("encodes separatedSuffixedBasename with multiple suffixes", () => {
			expect(
				makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename({
					nodeName: "NoteName",
					splitSuffix: ["child", "parent"],
				}),
			).toBe("NoteName-child-parent");
		});

		it("encodes deeply nested separatedSuffixedBasename", () => {
			expect(
				makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename({
					nodeName: "NoteName",
					splitSuffix: ["A", "B", "C", "D"],
				}),
			).toBe("NoteName-A-B-C-D");
		});

		it("encodes codex basename", () => {
			expect(
				makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename({
					nodeName: "__",
					splitSuffix: ["child", "parent"],
				}),
			).toBe("__-child-parent");
		});
	});

	describe("decode (canonicalBasename → separatedSuffixedBasename)", () => {
		it("decodes canonicalBasename with no suffix", () => {
			expect(makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename("NoteName")).toEqual({
				nodeName: "NoteName",
				splitSuffix: [],
			});
		});

		it("decodes canonicalBasename with single suffix", () => {
			expect(makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename("NoteName-child")).toEqual({
				nodeName: "NoteName",
				splitSuffix: ["child"],
			});
		});

		it("decodes canonicalBasename with multiple suffixes", () => {
			expect(
				makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename("NoteName-child-parent"),
			).toEqual({
				nodeName: "NoteName",
				splitSuffix: ["child", "parent"],
			});
		});

		it("decodes deeply nested canonicalBasename", () => {
			expect(makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename("NoteName-A-B-C-D")).toEqual({
				nodeName: "NoteName",
				splitSuffix: ["A", "B", "C", "D"],
			});
		});

		it("decodes codex basename", () => {
			expect(makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename("__-child-parent")).toEqual({
				nodeName: "__",
				splitSuffix: ["child", "parent"],
			});
		});

		it("handles custom delimiter", () => {
			getParsedUserSettingsSpy.mockReturnValue({
				...defaultSettings,
				suffixDelimiter: "::",
			});
			expect(makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename("NoteName::A::B")).toEqual({
				nodeName: "NoteName",
				splitSuffix: ["A", "B"],
			});
		});
	});

	describe("roundtrip (encode/decode)", () => {
		it("roundtrips separatedSuffixedBasename with no suffix", () => {
			const parsed = { nodeName: "NoteName", splitSuffix: [] };
			expect(
				makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename(
					makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename(parsed),
				),
			).toEqual(parsed);
		});

		it("roundtrips separatedSuffixedBasename with single suffix", () => {
			const parsed = { nodeName: "NoteName", splitSuffix: ["child"] };
			expect(
				makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename(
					makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename(parsed),
				),
			).toEqual(parsed);
		});

		it("roundtrips separatedSuffixedBasename with multiple suffixes", () => {
			const parsed = { nodeName: "NoteName", splitSuffix: ["child", "parent"] };
			expect(
				makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename(
					makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename(parsed),
				),
			).toEqual(parsed);
		});

		it("roundtrips deeply nested separatedSuffixedBasename", () => {
			const parsed = { nodeName: "NoteName", splitSuffix: ["A", "B", "C", "D"] };
			expect(
				makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename(
					makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename(parsed),
				),
			).toEqual(parsed);
		});

		it("roundtrips codex basename", () => {
			const parsed = { nodeName: "__", splitSuffix: ["child", "parent"] };
			expect(
				makeSeparatedSuffixedBasenameFromJoinedSuffixedBasename(
					makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename(parsed),
				),
			).toEqual(parsed);
		});
	});
});

