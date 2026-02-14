import { describe, expect, test } from "bun:test";
import {
	multiSpanHelper,
	type BracketedSpan,
	type ResolvedSpan,
} from "../../../src/stateless-helpers/multi-span";

// ─── parseBracketedSpans ───

describe("parseBracketedSpans", () => {
	test("parses single bracketed span", () => {
		const result = multiSpanHelper.parseBracketedSpans("[Pass] auf dich");
		expect(result).toEqual([
			{ text: "Pass", strippedStart: 0, strippedEnd: 4 },
		]);
	});

	test("parses multiple bracketed spans", () => {
		const result = multiSpanHelper.parseBracketedSpans(
			"[Pass] auf dich [auf]",
		);
		expect(result).toEqual([
			{ text: "Pass", strippedStart: 0, strippedEnd: 4 },
			{ text: "auf", strippedStart: 14, strippedEnd: 17 },
		]);
	});

	test("parses three bracketed spans (phrasem)", () => {
		const result = multiSpanHelper.parseBracketedSpans(
			"Das machen wir [auf] [jeden] [Fall] morgen.",
		);
		expect(result).toEqual([
			{ text: "auf", strippedStart: 15, strippedEnd: 18 },
			{ text: "jeden", strippedStart: 19, strippedEnd: 24 },
			{ text: "Fall", strippedStart: 25, strippedEnd: 29 },
		]);
	});

	test("returns empty array when no brackets", () => {
		const result =
			multiSpanHelper.parseBracketedSpans("keine Klammern hier");
		expect(result).toEqual([]);
	});

	test("handles malformed input (unclosed bracket)", () => {
		const result =
			multiSpanHelper.parseBracketedSpans("[unclosed bracket");
		// Should not crash; treats rest as plain text
		expect(result).toEqual([]);
	});

	test("stripped positions correspond to bracket-free text", () => {
		const marked = "Er [rief] seine Mutter [an]";
		const spans = multiSpanHelper.parseBracketedSpans(marked);
		const stripped = multiSpanHelper.stripBrackets(marked);

		for (const span of spans) {
			expect(stripped.slice(span.strippedStart, span.strippedEnd)).toBe(
				span.text,
			);
		}
	});
});

// ─── stripBrackets ───

describe("stripBrackets", () => {
	test("removes square brackets", () => {
		expect(multiSpanHelper.stripBrackets("[Pass] auf dich [auf]")).toBe(
			"Pass auf dich auf",
		);
	});

	test("no-op on text without brackets", () => {
		expect(multiSpanHelper.stripBrackets("no brackets")).toBe(
			"no brackets",
		);
	});
});

// ─── mapSpansToRawBlock ───

describe("mapSpansToRawBlock", () => {
	test("resolves spans in plain text (separable verb)", () => {
		const rawBlock = "Pass auf dich auf";
		const spans: BracketedSpan[] = [
			{ text: "Pass", strippedStart: 0, strippedEnd: 4 },
			{ text: "auf", strippedStart: 14, strippedEnd: 17 },
		];

		const result = multiSpanHelper.mapSpansToRawBlock(
			rawBlock,
			spans,
			"Pass",
			0,
		);

		expect(result).toEqual([
			{ text: "Pass", rawStart: 0, rawEnd: 4 },
			{ text: "auf", rawStart: 14, rawEnd: 17 },
		]);
	});

	test("resolves spans with bold decoration", () => {
		// Raw block has bold: "**Pass** auf dich auf"
		// Stripped: "Pass auf dich auf"
		// The anchor "Pass" is at raw offset 2 (inside **)
		const rawBlock = "**Pass** auf dich auf";
		const spans: BracketedSpan[] = [
			{ text: "Pass", strippedStart: 0, strippedEnd: 4 },
			{ text: "auf", strippedStart: 14, strippedEnd: 17 },
		];

		const result = multiSpanHelper.mapSpansToRawBlock(
			rawBlock,
			spans,
			"Pass",
			2, // "Pass" starts at offset 2 in "**Pass** auf..."
		);

		expect(result).not.toBeNull();
		expect(result).toHaveLength(2);
		// Anchor at known position
		expect(result![0]).toEqual({ text: "Pass", rawStart: 2, rawEnd: 6 });
		// "auf" (the separated prefix) at end
		expect(result![1]).toEqual({ text: "auf", rawStart: 18, rawEnd: 21 });
	});

	test("resolves phrasem spans (3 words)", () => {
		const rawBlock = "Das machen wir auf jeden Fall morgen.";
		const spans: BracketedSpan[] = [
			{ text: "auf", strippedStart: 15, strippedEnd: 18 },
			{ text: "jeden", strippedStart: 19, strippedEnd: 24 },
			{ text: "Fall", strippedStart: 25, strippedEnd: 29 },
		];

		const result = multiSpanHelper.mapSpansToRawBlock(
			rawBlock,
			spans,
			"Fall",
			25,
		);

		expect(result).toEqual([
			{ text: "auf", rawStart: 15, rawEnd: 18 },
			{ text: "jeden", rawStart: 19, rawEnd: 24 },
			{ text: "Fall", rawStart: 25, rawEnd: 29 },
		]);
	});

	test("disambiguates duplicate word using anchor calibration", () => {
		// "auf" appears twice: "Pass auf dich auf"
		// The LLM marked only the second "auf" (the separable prefix)
		const rawBlock = "Pass auf dich auf";
		const spans: BracketedSpan[] = [
			{ text: "Pass", strippedStart: 0, strippedEnd: 4 },
			// This "auf" is at stripped position 14, not 5
			{ text: "auf", strippedStart: 14, strippedEnd: 17 },
		];

		const result = multiSpanHelper.mapSpansToRawBlock(
			rawBlock,
			spans,
			"Pass",
			0,
		);

		expect(result).not.toBeNull();
		// Should resolve to the second "auf" (at position 14), not the first (at position 5)
		const aufSpan = result!.find(
			(s) => s.text === "auf" && s.rawStart === 14,
		);
		expect(aufSpan).toBeDefined();
	});

	test("skips spans inside existing wikilinks", () => {
		// "auf" is already inside a wikilink
		// "Er [[aufpassen|passt]] auf dich auf"
		//  0123456789...                   ^32
		const rawBlock = "Er [[aufpassen|passt]] auf dich auf";
		const spans: BracketedSpan[] = [
			{ text: "passt", strippedStart: 3, strippedEnd: 8 },
			{ text: "auf", strippedStart: 23, strippedEnd: 26 },
		];

		const result = multiSpanHelper.mapSpansToRawBlock(
			rawBlock,
			spans,
			"auf",
			32, // "auf" at end position
		);

		// Should still work — anchor is the last "auf"
		expect(result).not.toBeNull();
		// "passt" is inside [[ ]] so it gets skipped; only anchor remains
		expect(result!.length).toBeLessThanOrEqual(2);
	});

	test("returns null when anchor surface not found in spans", () => {
		const spans: BracketedSpan[] = [
			{ text: "Pass", strippedStart: 0, strippedEnd: 4 },
		];

		const result = multiSpanHelper.mapSpansToRawBlock(
			"Pass auf dich auf",
			spans,
			"MISSING",
			0,
		);

		expect(result).toBeNull();
	});

	test("returns null when anchor verification fails", () => {
		const spans: BracketedSpan[] = [
			{ text: "Pass", strippedStart: 0, strippedEnd: 4 },
		];

		// Offset 10 doesn't have "Pass"
		const result = multiSpanHelper.mapSpansToRawBlock(
			"Pass auf dich auf",
			spans,
			"Pass",
			10,
		);

		expect(result).toBeNull();
	});

	test("returns null for empty spans array", () => {
		const result = multiSpanHelper.mapSpansToRawBlock(
			"some text",
			[],
			"some",
			0,
		);
		expect(result).toBeNull();
	});
});

// ─── applyMultiSpanReplacement ───

describe("applyMultiSpanReplacement", () => {
	test("replaces two spans with wikilinks (separable verb)", () => {
		const rawBlock = "Pass auf dich auf";
		const resolved: ResolvedSpan[] = [
			{ text: "Pass", rawStart: 0, rawEnd: 4 },
			{ text: "auf", rawStart: 14, rawEnd: 17 },
		];

		const result = multiSpanHelper.applyMultiSpanReplacement(
			rawBlock,
			resolved,
			"aufpassen",
		);

		expect(result).toBe(
			"[[aufpassen|Pass]] auf dich [[aufpassen|auf]]",
		);
	});

	test("replaces three spans with wikilinks (phrasem)", () => {
		const rawBlock = "Das machen wir auf jeden Fall morgen.";
		const resolved: ResolvedSpan[] = [
			{ text: "auf", rawStart: 15, rawEnd: 18 },
			{ text: "jeden", rawStart: 19, rawEnd: 24 },
			{ text: "Fall", rawStart: 25, rawEnd: 29 },
		];

		const result = multiSpanHelper.applyMultiSpanReplacement(
			rawBlock,
			resolved,
			"auf jeden Fall",
		);

		expect(result).toBe(
			"Das machen wir [[auf jeden Fall|auf]] [[auf jeden Fall|jeden]] [[auf jeden Fall|Fall]] morgen.",
		);
	});

	test("preserves right-to-left replacement order (offsets stay valid)", () => {
		const rawBlock = "A B C";
		const resolved: ResolvedSpan[] = [
			{ text: "A", rawStart: 0, rawEnd: 1 },
			{ text: "C", rawStart: 4, rawEnd: 5 },
		];

		const result = multiSpanHelper.applyMultiSpanReplacement(
			rawBlock,
			resolved,
			"lemma",
		);

		expect(result).toBe("[[lemma|A]] B [[lemma|C]]");
	});

	test("handles span where text matches lemma (no alias needed)", () => {
		const rawBlock = "x aufpassen y";
		const resolved: ResolvedSpan[] = [
			{ text: "aufpassen", rawStart: 2, rawEnd: 11 },
		];

		const result = multiSpanHelper.applyMultiSpanReplacement(
			rawBlock,
			resolved,
			"aufpassen",
		);

		expect(result).toBe("x [[aufpassen]] y");
	});
});
