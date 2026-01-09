import { describe, it, expect } from "bun:test";
import type { SectionNodeSegmentId } from "../../../../../src/commanders/librarian-new/library-tree/tree-node/types/node-segment-id";
import {
	expandToAncestors,
	dedupeChains,
	collectImpactedSections,
} from "../../../../../src/commanders/librarian-new/library-tree/codex/section-chain-utils";

// Helper to create segment IDs for tests
const sec = (name: string): SectionNodeSegmentId =>
	`${name}﹘Section﹘` as SectionNodeSegmentId;

describe("section-chain-utils", () => {
	describe("expandToAncestors", () => {
		it("returns empty array for empty chain", () => {
			expect(expandToAncestors([])).toEqual([[]]);
		});

		it("expands single-element chain", () => {
			const chain = [sec("Library")];
			expect(expandToAncestors(chain)).toEqual([[], [sec("Library")]]);
		});

		it("expands multi-element chain to all prefixes", () => {
			const chain = [sec("Library"), sec("A"), sec("B")];
			expect(expandToAncestors(chain)).toEqual([
				[],
				[sec("Library")],
				[sec("Library"), sec("A")],
				[sec("Library"), sec("A"), sec("B")],
			]);
		});
	});

	describe("dedupeChains", () => {
		it("returns empty for empty input", () => {
			expect(dedupeChains([])).toEqual([]);
		});

		it("preserves unique chains", () => {
			const chains = [
				[sec("Library"), sec("A")],
				[sec("Library"), sec("B")],
			];
			expect(dedupeChains(chains)).toEqual(chains);
		});

		it("removes duplicate chains", () => {
			const chains = [
				[sec("Library"), sec("A")],
				[sec("Library"), sec("A")],
				[sec("Library"), sec("B")],
			];
			expect(dedupeChains(chains)).toEqual([
				[sec("Library"), sec("A")],
				[sec("Library"), sec("B")],
			]);
		});

		it("treats different chains as unique", () => {
			const chains = [
				[sec("Library"), sec("A")],
				[sec("Library"), sec("A"), sec("C")],
			];
			expect(dedupeChains(chains)).toEqual(chains);
		});

		it("handles empty chains", () => {
			const chains = [[], [], [sec("Library")]];
			expect(dedupeChains(chains)).toEqual([[], [sec("Library")]]);
		});
	});

	describe("collectImpactedSections", () => {
		it("expands and dedupes single chain, filters empty", () => {
			const chains = [[sec("Library"), sec("A"), sec("B")]];
			expect(collectImpactedSections(chains)).toEqual([
				[sec("Library")],
				[sec("Library"), sec("A")],
				[sec("Library"), sec("A"), sec("B")],
			]);
		});

		it("expands and dedupes overlapping chains", () => {
			const chains = [
				[sec("Library"), sec("A"), sec("B")],
				[sec("Library"), sec("A"), sec("C")],
			];
			// Both share [Library], [Library, A] (empty [] is filtered)
			expect(collectImpactedSections(chains)).toEqual([
				[sec("Library")],
				[sec("Library"), sec("A")],
				[sec("Library"), sec("A"), sec("B")],
				[sec("Library"), sec("A"), sec("C")],
			]);
		});

		it("handles empty input", () => {
			expect(collectImpactedSections([])).toEqual([]);
		});
	});
});
