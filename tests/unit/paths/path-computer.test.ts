/**
 * Tests for PathComputer module.
 * Ensures the consolidated path computation logic works correctly.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../src/commanders/librarian-new/codecs";
import {
	buildCodexBasename,
	buildObservedLeafSplitPath,
	computeCodexSuffix,
	parseChainToNodeNames,
	PathComputer,
	pathPartsToSuffixParts,
	pathPartsWithRootToSuffixParts,
	splitPathsEqual,
	suffixPartsToPathParts,
} from "../../../src/commanders/librarian-new/paths/path-computer";
import { TreeNodeKind, TreeNodeStatus } from "../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/atoms";
import type { ScrollNode, FileNode } from "../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/tree-node";
import type { NodeName } from "../../../src/commanders/librarian-new/types/schemas/node-name";
import type { SectionNodeSegmentId } from "../../../src/commanders/librarian-new/codecs/segment-id/types/segment-id";
import { NodeSegmentIdSeparator } from "../../../src/commanders/librarian-new/codecs/segment-id/types/segment-id";
import { defaultSettingsForUnitTests } from "../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("PathComputer", () => {
	describe("computeCodexSuffix", () => {
		it("returns empty for empty chain", () => {
			expect(computeCodexSuffix([])).toEqual([]);
		});

		it("returns single element unchanged", () => {
			expect(computeCodexSuffix(["root"])).toEqual(["root"]);
		});

		it("returns second element only for two-element chain", () => {
			expect(computeCodexSuffix(["root", "child"])).toEqual(["child"]);
		});

		it("returns reversed tail for three elements", () => {
			expect(computeCodexSuffix(["a", "b", "c"])).toEqual(["c", "b"]);
		});

		it("returns reversed tail for deep chains", () => {
			expect(computeCodexSuffix(["a", "b", "c", "d", "e"])).toEqual([
				"e",
				"d",
				"c",
				"b",
			]);
		});
	});

	describe("pathPartsToSuffixParts", () => {
		it("reverses empty array", () => {
			expect(pathPartsToSuffixParts([])).toEqual([]);
		});

		it("reverses single element", () => {
			expect(pathPartsToSuffixParts(["a"])).toEqual(["a"]);
		});

		it("reverses multiple elements", () => {
			expect(pathPartsToSuffixParts(["a", "b", "c"])).toEqual(["c", "b", "a"]);
		});
	});

	describe("pathPartsWithRootToSuffixParts", () => {
		it("returns empty for path with only root", () => {
			expect(pathPartsWithRootToSuffixParts(["Library"])).toEqual([]);
		});

		it("returns single element for root + one", () => {
			expect(pathPartsWithRootToSuffixParts(["Library", "a"])).toEqual(["a"]);
		});

		it("returns reversed tail for multiple elements", () => {
			expect(pathPartsWithRootToSuffixParts(["Library", "a", "b", "c"])).toEqual([
				"c",
				"b",
				"a",
			]);
		});
	});

	describe("suffixPartsToPathParts", () => {
		it("reverses suffix parts back to path parts", () => {
			const original = ["a", "b", "c"];
			const suffix = pathPartsToSuffixParts(original);
			const restored = suffixPartsToPathParts(suffix as NodeName[]);
			expect(restored).toEqual(original);
		});
	});

	describe("parseChainToNodeNames", () => {
		const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
		const codecs = makeCodecs(rules);
		const sep = NodeSegmentIdSeparator;

		it("returns error for empty chain", () => {
			const result = parseChainToNodeNames([], codecs);
			expect(result.isErr()).toBe(true);
			if (result.isErr()) {
				expect(result.error.kind).toBe("EmptyChain");
			}
		});

		it("parses valid section chain", () => {
			const chain = [
				`recipes${sep}Section${sep}` as SectionNodeSegmentId,
				`soup${sep}Section${sep}` as SectionNodeSegmentId,
			];
			const result = parseChainToNodeNames(chain, codecs);
			expect(result.isOk()).toBe(true);
			if (result.isOk()) {
				expect(result.value).toEqual(["recipes", "soup"]);
			}
		});

		it("returns error for invalid segment ID", () => {
			const chain = ["invalid-segment" as SectionNodeSegmentId];
			const result = parseChainToNodeNames(chain, codecs);
			expect(result.isErr()).toBe(true);
		});
	});

	describe("buildObservedLeafSplitPath", () => {
		const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
		const codecs = makeCodecs(rules);

		function makeScrollNode(name: string): ScrollNode {
			return {
				extension: "md",
				kind: TreeNodeKind.Scroll,
				nodeName: name as NodeName,
				status: TreeNodeStatus.NotStarted,
			};
		}

		function makeFileNode(name: string, ext: string): FileNode {
			return {
				extension: ext,
				kind: TreeNodeKind.File,
				nodeName: name as NodeName,
				status: TreeNodeStatus.Unknown,
			};
		}

		it("builds path with suffix from old location", () => {
			const leaf = makeScrollNode("Note");
			const result = buildObservedLeafSplitPath(
				leaf,
				["Library", "recipes", "soup"], // old path
				["Library", "recipes", "stew"], // current path
				codecs,
			);

			// Suffix comes from OLD path
			expect(result.basename).toBe("Note-soup-recipes");
			// pathParts from NEW path
			expect(result.pathParts).toEqual(["Library", "recipes", "stew"]);
		});

		it("builds path for file node", () => {
			const leaf = makeFileNode("image", "png");
			const result = buildObservedLeafSplitPath(
				leaf,
				["Library", "assets"],
				["Library", "assets"],
				codecs,
			);

			expect(result.basename).toBe("image-assets");
			expect(result.extension).toBe("png");
		});
	});

	describe("buildCodexBasename", () => {
		const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
		const codecs = makeCodecs(rules);

		it("builds codex basename for single node", () => {
			const basename = buildCodexBasename(["recipes"], "__", codecs);
			expect(basename).toBe("__-recipes");
		});

		it("builds codex basename for nested nodes", () => {
			const basename = buildCodexBasename(["recipes", "soup"], "__", codecs);
			expect(basename).toBe("__-soup");
		});

		it("builds codex basename for deep nesting", () => {
			const basename = buildCodexBasename(
				["recipes", "soup", "ramen"],
				"__",
				codecs,
			);
			expect(basename).toBe("__-ramen-soup");
		});
	});

	describe("splitPathsEqual", () => {
		it("returns true for identical paths", () => {
			const a = { kind: "MdFile", basename: "note", pathParts: ["a", "b"], extension: "md" };
			const b = { kind: "MdFile", basename: "note", pathParts: ["a", "b"], extension: "md" };
			expect(splitPathsEqual(a, b)).toBe(true);
		});

		it("returns false for different basenames", () => {
			const a = { kind: "MdFile", basename: "note1", pathParts: ["a"], extension: "md" };
			const b = { kind: "MdFile", basename: "note2", pathParts: ["a"], extension: "md" };
			expect(splitPathsEqual(a, b)).toBe(false);
		});

		it("returns false for different path parts", () => {
			const a = { kind: "MdFile", basename: "note", pathParts: ["a"], extension: "md" };
			const b = { kind: "MdFile", basename: "note", pathParts: ["b"], extension: "md" };
			expect(splitPathsEqual(a, b)).toBe(false);
		});

		it("returns false for different kinds", () => {
			const a = { kind: "MdFile", basename: "note", pathParts: ["a"], extension: "md" };
			const b = { kind: "File", basename: "note", pathParts: ["a"], extension: "txt" };
			expect(splitPathsEqual(a, b)).toBe(false);
		});
	});

	describe("PathComputer namespace", () => {
		it("exports all functions", () => {
			expect(PathComputer.computeCodexSuffix).toBeDefined();
			expect(PathComputer.pathPartsToSuffixParts).toBeDefined();
			expect(PathComputer.pathPartsWithRootToSuffixParts).toBeDefined();
			expect(PathComputer.suffixPartsToPathParts).toBeDefined();
			expect(PathComputer.parseChainToNodeNames).toBeDefined();
			expect(PathComputer.buildObservedLeafSplitPath).toBeDefined();
			expect(PathComputer.buildCodexBasename).toBeDefined();
			expect(PathComputer.splitPathsEqual).toBeDefined();
		});
	});
});
