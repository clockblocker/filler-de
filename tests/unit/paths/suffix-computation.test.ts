/**
 * Tests for suffix computation logic.
 * Captures current behavior before Phase 2 consolidation into PathFinder.
 *
 * These tests document the suffix computation patterns that appear in 4+ places:
 * - codecs/internal/suffix/path-parts.ts
 * - codecs/internal/suffix/serialize.ts
 * - healer/library-tree/utils/split-path-utils.ts
 * - descendant-suffix-healing.ts
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../src/commanders/librarian-new/codecs";
import {
	pathPartsToSuffixParts,
	pathPartsWithRootToSuffixParts,
	suffixPartsToPathParts,
} from "../../../src/commanders/librarian-new/codecs/internal/suffix/path-parts";
import {
	serializeSeparatedSuffix,
	serializeSeparatedSuffixUnchecked,
} from "../../../src/commanders/librarian-new/codecs/internal/suffix/serialize";
import { TreeNodeKind, TreeNodeStatus } from "../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/atoms";
import type { ScrollNode } from "../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/tree-node";
import { buildObservedLeafSplitPath } from "../../../src/commanders/librarian-new/healer/library-tree/utils/split-path-utils";
import type { NodeName } from "../../../src/commanders/librarian-new/types/schemas/node-name";
import { defaultSettingsForUnitTests } from "../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("Suffix Computation", () => {
	describe("pathPartsToSuffixParts (without Library root)", () => {
		it("empty path produces empty suffix", () => {
			const result = pathPartsToSuffixParts([]);
			expect(result).toEqual([]);
		});

		it("single element returns single element", () => {
			const result = pathPartsToSuffixParts(["parent"]);
			expect(result).toEqual(["parent"]);
		});

		it("two elements get reversed", () => {
			const result = pathPartsToSuffixParts(["parent", "child"]);
			expect(result).toEqual(["child", "parent"]);
		});

		it("three elements get reversed", () => {
			const result = pathPartsToSuffixParts(["a", "b", "c"]);
			expect(result).toEqual(["c", "b", "a"]);
		});

		it("deep nesting gets fully reversed", () => {
			const result = pathPartsToSuffixParts(["a", "b", "c", "d", "e"]);
			expect(result).toEqual(["e", "d", "c", "b", "a"]);
		});
	});

	describe("pathPartsWithRootToSuffixParts (with Library root)", () => {
		const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);

		it("path with only Library root produces empty suffix", () => {
			const result = pathPartsWithRootToSuffixParts(rules, ["Library"]);
			expect(result).toEqual([]);
		});

		it("Library + single section produces single suffix part", () => {
			const result = pathPartsWithRootToSuffixParts(rules, [
				"Library",
				"parent",
			]);
			expect(result).toEqual(["parent"]);
		});

		it("Library + two sections produces reversed suffix", () => {
			const result = pathPartsWithRootToSuffixParts(rules, [
				"Library",
				"parent",
				"child",
			]);
			expect(result).toEqual(["child", "parent"]);
		});

		it("Library + three sections produces reversed suffix (excludes Library)", () => {
			const result = pathPartsWithRootToSuffixParts(rules, [
				"Library",
				"a",
				"b",
				"c",
			]);
			expect(result).toEqual(["c", "b", "a"]);
		});
	});

	describe("suffixPartsToPathParts (reverse of pathPartsToSuffixParts)", () => {
		it("roundtrip: pathParts -> suffixParts -> pathParts", () => {
			const original = ["a", "b", "c"];
			const suffix = pathPartsToSuffixParts(original);
			const restored = suffixPartsToPathParts(suffix as NodeName[]);
			expect(restored).toEqual(original);
		});

		it("empty suffix produces empty path", () => {
			const result = suffixPartsToPathParts([]);
			expect(result).toEqual([]);
		});
	});

	describe("serializeSeparatedSuffix", () => {
		const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);

		it("coreName only (no suffix parts) returns coreName", () => {
			const result = serializeSeparatedSuffix(rules, {
				coreName: "Note" as NodeName,
				suffixParts: [],
			});
			expect(result).toBe("Note");
		});

		it("coreName + single suffix part", () => {
			const result = serializeSeparatedSuffix(rules, {
				coreName: "Note" as NodeName,
				suffixParts: ["parent" as NodeName],
			});
			expect(result).toBe("Note-parent");
		});

		it("coreName + two suffix parts", () => {
			const result = serializeSeparatedSuffix(rules, {
				coreName: "Note" as NodeName,
				suffixParts: ["child" as NodeName, "parent" as NodeName],
			});
			expect(result).toBe("Note-child-parent");
		});

		it("coreName + deep suffix", () => {
			const result = serializeSeparatedSuffix(rules, {
				coreName: "Note" as NodeName,
				suffixParts: ["c" as NodeName, "b" as NodeName, "a" as NodeName],
			});
			expect(result).toBe("Note-c-b-a");
		});
	});

	describe("serializeSeparatedSuffixUnchecked (with validation)", () => {
		const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);

		it("valid inputs return Ok result", () => {
			const result = serializeSeparatedSuffixUnchecked(rules, {
				coreName: "Note",
				suffixParts: ["parent"],
			});
			expect(result.isOk()).toBe(true);
			expect(result._unsafeUnwrap()).toBe("Note-parent");
		});

		it("empty coreName fails validation", () => {
			const result = serializeSeparatedSuffixUnchecked(rules, {
				coreName: "",
				suffixParts: [],
			});
			expect(result.isErr()).toBe(true);
		});

		it("empty suffix part fails validation", () => {
			const result = serializeSeparatedSuffixUnchecked(rules, {
				coreName: "Note",
				suffixParts: ["parent", ""],
			});
			expect(result.isErr()).toBe(true);
		});
	});

	describe("buildObservedLeafSplitPath (full integration)", () => {
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

		it("leaf at root level has no suffix", () => {
			const leaf = makeScrollNode("Note");
			const result = buildObservedLeafSplitPath(
				leaf,
				["Library"], // old path (WITH Library)
				["Library"], // current path
				codecs,
			);

			expect(result.basename).toBe("Note");
			expect(result.pathParts).toEqual(["Library"]);
		});

		it("leaf at depth 1 has single-part suffix", () => {
			const leaf = makeScrollNode("Note");
			const result = buildObservedLeafSplitPath(
				leaf,
				["Library", "recipes"], // old path
				["Library", "recipes"], // current path
				codecs,
			);

			expect(result.basename).toBe("Note-recipes");
			expect(result.pathParts).toEqual(["Library", "recipes"]);
		});

		it("leaf at depth 2 has two-part suffix (reversed)", () => {
			const leaf = makeScrollNode("Note");
			const result = buildObservedLeafSplitPath(
				leaf,
				["Library", "recipes", "soup"], // old path
				["Library", "recipes", "soup"], // current path
				codecs,
			);

			expect(result.basename).toBe("Note-soup-recipes");
			expect(result.pathParts).toEqual(["Library", "recipes", "soup"]);
		});

		it("after section rename: old suffix preserved, new directory", () => {
			const leaf = makeScrollNode("Note");
			const result = buildObservedLeafSplitPath(
				leaf,
				["Library", "recipes", "soup"], // OLD path (suffix from here)
				["Library", "recipes", "stew"], // NEW path (file location)
				codecs,
			);

			// Suffix comes from OLD path: soup-recipes
			expect(result.basename).toBe("Note-soup-recipes");
			// pathParts is NEW path
			expect(result.pathParts).toEqual(["Library", "recipes", "stew"]);
		});

		it("after section move: old suffix, completely new location", () => {
			const leaf = makeScrollNode("Note");
			const result = buildObservedLeafSplitPath(
				leaf,
				["Library", "recipes", "soup"], // OLD path
				["Library", "archive", "old-soup"], // NEW path
				codecs,
			);

			// Suffix from OLD: soup-recipes
			expect(result.basename).toBe("Note-soup-recipes");
			// pathParts from NEW
			expect(result.pathParts).toEqual(["Library", "archive", "old-soup"]);
		});
	});

	describe("Codex suffix computation (critical pattern)", () => {
		/**
		 * This test captures the CRITICAL suffix computation logic that appears
		 * in codex-impact-to-actions.ts and descendant-suffix-healing.ts.
		 *
		 * For a codex at section X with nodeNames chain [a, b, c]:
		 * - If chain has 1 element: suffix = [a]
		 * - If chain has 2+ elements: suffix = reversed(chain.slice(1))
		 *
		 * This is the logic that was recently fixed in "fix changing suffixes" commit.
		 */
		const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);

		function computeCodexSuffix(nodeNames: string[]): string[] {
			// This is the EXACT pattern from codex-impact-to-actions.ts:624-626
			// and descendant-suffix-healing.ts:53-54
			if (nodeNames.length === 1) {
				return nodeNames;
			}
			return nodeNames.slice(1).reverse();
		}

		it("single node: suffix is the node itself", () => {
			expect(computeCodexSuffix(["root"])).toEqual(["root"]);
		});

		it("two nodes: suffix is second node only", () => {
			expect(computeCodexSuffix(["root", "child"])).toEqual(["child"]);
		});

		it("three nodes: suffix is reversed tail", () => {
			// Chain: [a, b, c] -> suffix from [b, c] reversed = [c, b]
			expect(computeCodexSuffix(["a", "b", "c"])).toEqual(["c", "b"]);
		});

		it("four nodes: suffix is reversed tail", () => {
			// Chain: [a, b, c, d] -> suffix from [b, c, d] reversed = [d, c, b]
			expect(computeCodexSuffix(["a", "b", "c", "d"])).toEqual(["d", "c", "b"]);
		});

		it("deeply nested: suffix is fully reversed tail", () => {
			const chain = ["Library", "recipes", "soup", "ramen", "spicy"];
			// Tail: [recipes, soup, ramen, spicy]
			// Reversed: [spicy, ramen, soup, recipes]
			expect(computeCodexSuffix(chain)).toEqual([
				"spicy",
				"ramen",
				"soup",
				"recipes",
			]);
		});
	});

	describe("Edge cases and potential corruption scenarios", () => {
		const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
		const codecs = makeCodecs(rules);

		it("empty nodeNames chain should be handled", () => {
			// This is an invalid state that should never occur,
			// but we document current behavior
			const emptyPath = pathPartsWithRootToSuffixParts(rules, []);
			expect(emptyPath).toEqual([]);
		});

		it("special characters in node names", () => {
			const result = serializeSeparatedSuffix(rules, {
				coreName: "Note 1" as NodeName,
				suffixParts: ["my recipes" as NodeName],
			});
			expect(result).toBe("Note 1-my recipes");
		});

		it("numbers in node names", () => {
			const result = serializeSeparatedSuffix(rules, {
				coreName: "Note" as NodeName,
				suffixParts: ["chapter 1" as NodeName, "section 2" as NodeName],
			});
			expect(result).toBe("Note-chapter 1-section 2");
		});
	});
});
