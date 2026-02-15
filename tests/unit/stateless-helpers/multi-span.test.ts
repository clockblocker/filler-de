import { describe, expect, test } from "bun:test";
import {
	type BracketedSpan,
	multiSpanHelper,
	type ResolvedSpan,
} from "../../../src/stateless-helpers/multi-span";

// ─── parseBracketedSpans ───

describe("parseBracketedSpans", () => {
	test("parses single bracketed span", () => {
		const result = multiSpanHelper.parseBracketedSpans("[Pass] auf dich");
		expect(result).toEqual([
			{ strippedEnd: 4, strippedStart: 0, text: "Pass" },
		]);
	});

	test("parses multiple bracketed spans", () => {
		const result = multiSpanHelper.parseBracketedSpans(
			"[Pass] auf dich [auf]",
		);
		expect(result).toEqual([
			{ strippedEnd: 4, strippedStart: 0, text: "Pass" },
			{ strippedEnd: 17, strippedStart: 14, text: "auf" },
		]);
	});

	test("parses three bracketed spans (phrasem)", () => {
		const result = multiSpanHelper.parseBracketedSpans(
			"Das machen wir [auf] [jeden] [Fall] morgen.",
		);
		expect(result).toEqual([
			{ strippedEnd: 18, strippedStart: 15, text: "auf" },
			{ strippedEnd: 24, strippedStart: 19, text: "jeden" },
			{ strippedEnd: 29, strippedStart: 25, text: "Fall" },
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
			{ strippedEnd: 4, strippedStart: 0, text: "Pass" },
			{ strippedEnd: 17, strippedStart: 14, text: "auf" },
		];

		const result = multiSpanHelper.mapSpansToRawBlock(
			rawBlock,
			spans,
			"Pass",
			0,
		);

		expect(result).toEqual([
			{ rawEnd: 4, rawStart: 0, text: "Pass" },
			{ rawEnd: 17, rawStart: 14, text: "auf" },
		]);
	});

	test("resolves spans with bold decoration", () => {
		// Raw block has bold: "**Pass** auf dich auf"
		// Stripped: "Pass auf dich auf"
		// The anchor "Pass" is at raw offset 2 (inside **)
		const rawBlock = "**Pass** auf dich auf";
		const spans: BracketedSpan[] = [
			{ strippedEnd: 4, strippedStart: 0, text: "Pass" },
			{ strippedEnd: 17, strippedStart: 14, text: "auf" },
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
		expect(result![0]).toEqual({ rawEnd: 6, rawStart: 2, text: "Pass" });
		// "auf" (the separated prefix) at end
		expect(result![1]).toEqual({ rawEnd: 21, rawStart: 18, text: "auf" });
	});

	test("resolves phrasem spans (3 words)", () => {
		const rawBlock = "Das machen wir auf jeden Fall morgen.";
		const spans: BracketedSpan[] = [
			{ strippedEnd: 18, strippedStart: 15, text: "auf" },
			{ strippedEnd: 24, strippedStart: 19, text: "jeden" },
			{ strippedEnd: 29, strippedStart: 25, text: "Fall" },
		];

		const result = multiSpanHelper.mapSpansToRawBlock(
			rawBlock,
			spans,
			"Fall",
			25,
		);

		expect(result).toEqual([
			{ rawEnd: 18, rawStart: 15, text: "auf" },
			{ rawEnd: 24, rawStart: 19, text: "jeden" },
			{ rawEnd: 29, rawStart: 25, text: "Fall" },
		]);
	});

	test("disambiguates duplicate word using anchor calibration", () => {
		// "auf" appears twice: "Pass auf dich auf"
		// The LLM marked only the second "auf" (the separable prefix)
		const rawBlock = "Pass auf dich auf";
		const spans: BracketedSpan[] = [
			{ strippedEnd: 4, strippedStart: 0, text: "Pass" },
			// This "auf" is at stripped position 14, not 5
			{ strippedEnd: 17, strippedStart: 14, text: "auf" },
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
			{ strippedEnd: 8, strippedStart: 3, text: "passt" },
			{ strippedEnd: 26, strippedStart: 23, text: "auf" },
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
			{ strippedEnd: 4, strippedStart: 0, text: "Pass" },
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
			{ strippedEnd: 4, strippedStart: 0, text: "Pass" },
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
			{ rawEnd: 4, rawStart: 0, text: "Pass" },
			{ rawEnd: 17, rawStart: 14, text: "auf" },
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
			{ rawEnd: 18, rawStart: 15, text: "auf" },
			{ rawEnd: 24, rawStart: 19, text: "jeden" },
			{ rawEnd: 29, rawStart: 25, text: "Fall" },
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
			{ rawEnd: 1, rawStart: 0, text: "A" },
			{ rawEnd: 5, rawStart: 4, text: "C" },
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
			{ rawEnd: 11, rawStart: 2, text: "aufpassen" },
		];

		const result = multiSpanHelper.applyMultiSpanReplacement(
			rawBlock,
			resolved,
			"aufpassen",
		);

		expect(result).toBe("x [[aufpassen]] y");
	});
});
