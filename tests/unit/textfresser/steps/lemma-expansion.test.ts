import { describe, expect, test } from "bun:test";
import { expandOffsetForLinkedSpan } from "../../../../src/commanders/textfresser/commands/lemma/lemma-command";

describe("expandOffsetForLinkedSpan", () => {
	test("expands offset when linked span extends before the selected surface", () => {
		const rawBlock = "bei der Deutsche Bank eröffnet";
		//                         ^^^^^^^^^^^^^^^
		//                         offset 8 for "Deutsche Bank"
		//                                      ^^^^
		//                                      offset 17 for "Bank"
		const result = expandOffsetForLinkedSpan(
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

	test("returns original offset/surface when linked surface equals selected surface", () => {
		const rawBlock = "Ich wohne in Berlin.";
		const result = expandOffsetForLinkedSpan(
			rawBlock,
			"Berlin",
			13,
			"Berlin",
		);
		expect(result).toEqual({
			replaceOffset: 13,
			replaceSurface: "Berlin",
		});
	});

	test("falls back when verification fails (text mismatch in raw block)", () => {
		const rawBlock = "bei einer deutschen Bank eröffnet";
		// linked span "Deutsche Bank" won't match at the computed offset
		const result = expandOffsetForLinkedSpan(
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

	test("falls back when selected surface is not found in linked span", () => {
		const rawBlock = "bei der Deutsche Bank eröffnet";
		const result = expandOffsetForLinkedSpan(
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

	test("handles linked span where selected surface is at the beginning", () => {
		const rawBlock = "Die Bank of America ist groß.";
		//                    ^^^^^^^^^^^^^^^^^
		//                    offset 4 for "Bank of America"
		//                    ^^^^
		//                    offset 4 for "Bank"
		const result = expandOffsetForLinkedSpan(
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

	test("handles linked span where selected surface is in the middle", () => {
		const rawBlock = "Der New York Times Artikel war gut.";
		//                    ^^^^^^^^^^^^^^^
		//                    offset 4 for "New York Times"
		//                        ^^^^
		//                        offset 8 for "York"
		const result = expandOffsetForLinkedSpan(
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
