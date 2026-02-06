import { describe, expect, test } from "bun:test";
import { expandOffsetForFullSurface } from "../../../../src/commanders/textfresser/commands/lemma/lemma-command";

describe("expandOffsetForFullSurface", () => {
	test("expands offset when fullSurface extends before the surface", () => {
		const rawBlock = "bei der Deutsche Bank eröffnet";
		//                         ^^^^^^^^^^^^^^^
		//                         offset 8 for "Deutsche Bank"
		//                                      ^^^^
		//                                      offset 17 for "Bank"
		const result = expandOffsetForFullSurface(
			rawBlock,
			"Bank",
			17,
			"Deutsche Bank",
		);
		expect(result).toEqual({
			replaceOffset: 8,
			replaceSurface: "Deutsche Bank",
		});
	});

	test("returns original surface when fullSurface matches surface position exactly", () => {
		const rawBlock = "Ich wohne in Berlin.";
		const result = expandOffsetForFullSurface(
			rawBlock,
			"Berlin",
			13,
			"Berlin",
		);
		// fullSurface === surface, so surfaceIdxInFull = 0, expandedOffset = 13
		expect(result).toEqual({
			replaceOffset: 13,
			replaceSurface: "Berlin",
		});
	});

	test("falls back when verification fails (text mismatch)", () => {
		const rawBlock = "bei einer deutschen Bank eröffnet";
		// fullSurface "Deutsche Bank" won't match at the computed offset
		const result = expandOffsetForFullSurface(
			rawBlock,
			"Bank",
			20,
			"Deutsche Bank",
		);
		expect(result).toEqual({
			replaceOffset: 20,
			replaceSurface: "Bank",
		});
	});

	test("falls back when surface is not found in fullSurface", () => {
		const rawBlock = "bei der Deutsche Bank eröffnet";
		const result = expandOffsetForFullSurface(
			rawBlock,
			"Foo",
			8,
			"Deutsche Bank",
		);
		expect(result).toEqual({
			replaceOffset: 8,
			replaceSurface: "Foo",
		});
	});

	test("handles fullSurface where surface is at the beginning", () => {
		const rawBlock = "Die Bank of America ist groß.";
		//                    ^^^^^^^^^^^^^^^^^
		//                    offset 4 for "Bank of America"
		//                    ^^^^
		//                    offset 4 for "Bank"
		const result = expandOffsetForFullSurface(
			rawBlock,
			"Bank",
			4,
			"Bank of America",
		);
		expect(result).toEqual({
			replaceOffset: 4,
			replaceSurface: "Bank of America",
		});
	});

	test("handles fullSurface where surface is in the middle", () => {
		const rawBlock = "Der New York Times Artikel war gut.";
		//                    ^^^^^^^^^^^^^^^
		//                    offset 4 for "New York Times"
		//                        ^^^^
		//                        offset 8 for "York"
		const result = expandOffsetForFullSurface(
			rawBlock,
			"York",
			8,
			"New York Times",
		);
		expect(result).toEqual({
			replaceOffset: 4,
			replaceSurface: "New York Times",
		});
	});
});
