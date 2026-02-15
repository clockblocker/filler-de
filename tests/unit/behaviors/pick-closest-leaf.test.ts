import { describe, expect, it } from "bun:test";
import type { LeafMatch } from "../../../src/commanders/librarian/healer/library-tree/types/leaf-match";
import { pickClosestLeaf } from "../../../src/managers/obsidian/behavior-manager/pick-closest-leaf";

describe("pickClosestLeaf", () => {
	it("returns single match directly", () => {
		const match: LeafMatch = {
			basename: "pick-german",
			pathParts: ["Library", "german"],
		};

		expect(pickClosestLeaf([match], ["Library", "german"])).toBe(match);
	});

	it("picks match with longest common prefix", () => {
		const german: LeafMatch = {
			basename: "pick-german",
			pathParts: ["Library", "german"],
		};
		const english: LeafMatch = {
			basename: "pick-english",
			pathParts: ["Library", "english"],
		};

		// Active file is in Library/german/word → german should win
		const result = pickClosestLeaf(
			[english, german],
			["Library", "german", "word"],
		);
		expect(result).toBe(german);
	});

	it("tie-breaks by shallower depth", () => {
		const shallow: LeafMatch = {
			basename: "pick-german",
			pathParts: ["Library", "german"],
		};
		const deep: LeafMatch = {
			basename: "pick-word-german",
			pathParts: ["Library", "german", "word"],
		};

		// Both share prefix ["Library", "german"] with current path,
		// but shallow has fewer pathParts
		const result = pickClosestLeaf(
			[deep, shallow],
			["Library", "german", "other"],
		);
		expect(result).toBe(shallow);
	});

	it("returns first match when all are equally distant", () => {
		const a: LeafMatch = {
			basename: "pick-alpha",
			pathParts: ["Library", "alpha"],
		};
		const b: LeafMatch = {
			basename: "pick-beta",
			pathParts: ["Library", "beta"],
		};

		// Current path shares only ["Library"] with both
		const result = pickClosestLeaf([a, b], ["Library", "gamma"]);
		expect(result).toBe(a);
	});

	it("works when active file is outside library", () => {
		const match: LeafMatch = {
			basename: "pick-german",
			pathParts: ["Library", "german"],
		};
		const match2: LeafMatch = {
			basename: "pick-english",
			pathParts: ["Library", "english"],
		};

		// Active file not in Library at all → both have 0 common prefix
		const result = pickClosestLeaf([match, match2], ["Notes", "daily"]);
		expect(result).toBe(match);
	});

	it("handles deeply nested common prefix", () => {
		const deep: LeafMatch = {
			basename: "pick-verb-word-german",
			pathParts: ["Library", "german", "word", "verb"],
		};
		const shallow: LeafMatch = {
			basename: "pick-german",
			pathParts: ["Library", "german"],
		};

		// Active file is in Library/german/word/verb/sub → deep wins with 4 prefix
		const result = pickClosestLeaf(
			[shallow, deep],
			["Library", "german", "word", "verb", "sub"],
		);
		expect(result).toBe(deep);
	});
});
