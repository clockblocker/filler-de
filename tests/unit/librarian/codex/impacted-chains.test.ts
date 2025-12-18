import { describe, expect, it } from "vitest";
import {
	collectImpactedSections,
	dedupeChains,
	expandAllToAncestors,
	expandToAncestors,
	findCommonAncestor,
	flattenActionResult,
} from "../../../../src/commanders/librarian/codex/impacted-chains";

describe("impacted-chains", () => {
	describe("flattenActionResult", () => {
		it("flattens single chain", () => {
			const result = flattenActionResult(["A", "B"]);
			expect(result).toEqual([["A", "B"]]);
		});

		it("flattens tuple of chains (MoveNode result)", () => {
			const result = flattenActionResult([["A"], ["B", "C"]]);
			expect(result).toEqual([["A"], ["B", "C"]]);
		});
	});

	describe("expandToAncestors", () => {
		it("expands chain to all ancestors", () => {
			const result = expandToAncestors(["A", "B", "C"]);
			expect(result).toEqual([["A"], ["A", "B"], ["A", "B", "C"]]);
		});

		it("handles empty chain", () => {
			const result = expandToAncestors([]);
			expect(result).toEqual([]);
		});

		it("handles single element", () => {
			const result = expandToAncestors(["A"]);
			expect(result).toEqual([["A"]]);
		});
	});

	describe("expandAllToAncestors", () => {
		it("expands multiple chains", () => {
			const result = expandAllToAncestors([["A", "B"], ["C"]]);
			expect(result).toEqual([["A"], ["A", "B"], ["C"]]);
		});
	});

	describe("dedupeChains", () => {
		it("removes duplicate chains", () => {
			const result = dedupeChains([
				["A", "B"],
				["A"],
				["A", "B"],
				["C"],
			]);
			expect(result).toEqual([["A", "B"], ["A"], ["C"]]);
		});

		it("preserves order of first occurrence", () => {
			const result = dedupeChains([["B"], ["A"], ["B"]]);
			expect(result).toEqual([["B"], ["A"]]);
		});
	});

	describe("collectImpactedSections", () => {
		it("collects and expands from single action", () => {
			const result = collectImpactedSections([["A", "B"]]);
			expect(result).toEqual([["A"], ["A", "B"]]);
		});

		it("collects from MoveNode (tuple result)", () => {
			const result = collectImpactedSections([[["A"], ["B", "C"]]]);
			expect(result).toEqual([["A"], ["B"], ["B", "C"]]);
		});

		it("dedupes across multiple actions", () => {
			const result = collectImpactedSections([
				["A", "B"],
				["A", "C"],
			]);
			// A appears in both expansions, should be deduped
			expect(result).toEqual([["A"], ["A", "B"], ["A", "C"]]);
		});
	});

	describe("findCommonAncestor", () => {
		it("finds common prefix of two chains", () => {
			const result = findCommonAncestor([
				["A", "B", "C"],
				["A", "B", "D"],
			]);
			expect(result).toEqual(["A", "B"]);
		});

		it("returns empty for no common prefix", () => {
			const result = findCommonAncestor([["A", "B"], ["C", "D"]]);
			expect(result).toEqual([]);
		});

		it("returns first chain for single input", () => {
			const result = findCommonAncestor([["A", "B"]]);
			expect(result).toEqual(["A", "B"]);
		});

		it("returns empty for empty input", () => {
			const result = findCommonAncestor([]);
			expect(result).toEqual([]);
		});

		it("handles chains of different lengths", () => {
			const result = findCommonAncestor([
				["A", "B", "C", "D"],
				["A", "B"],
			]);
			expect(result).toEqual(["A", "B"]);
		});
	});
});
