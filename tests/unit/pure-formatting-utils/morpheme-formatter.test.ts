import { describe, expect, it } from "bun:test";
import { morphemeFormatterHelper } from "../../../src/stateless-helpers/morpheme-formatter";

describe("morphemeFormatterHelper.decorateSurface", () => {
	it("returns raw surf when no tags", () => {
		expect(morphemeFormatterHelper.decorateSurface("auf", undefined, "German")).toBe("auf");
	});

	it("returns raw surf when tags is empty array", () => {
		expect(morphemeFormatterHelper.decorateSurface("auf", [], "German")).toBe("auf");
	});

	it("decorates German Separable prefix with >", () => {
		expect(
			morphemeFormatterHelper.decorateSurface("auf", ["Separable"], "German"),
		).toBe(">auf");
	});

	it("decorates German Inseparable prefix with <", () => {
		expect(
			morphemeFormatterHelper.decorateSurface("ver", ["Inseparable"], "German"),
		).toBe("ver<");
	});

	it("ignores tags for English", () => {
		expect(
			morphemeFormatterHelper.decorateSurface("auf", ["Separable"], "English"),
		).toBe("auf");
	});

	it("ignores tags for English (Inseparable)", () => {
		expect(
			morphemeFormatterHelper.decorateSurface("ver", ["Inseparable"], "English"),
		).toBe("ver");
	});
});

describe("morphemeFormatterHelper.formatAsWikilink", () => {
	it("formats simple morpheme (no lemma, no tags)", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Root", surf: "passen" },
				"German",
			),
		).toBe("[[passen]]");
	});

	it("formats morpheme with lemma different from surf", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Root", lemma: "sing", surf: "sang" },
				"German",
			),
		).toBe("[[sing|sang]]");
	});

	it("formats morpheme where lemma equals surf (treated as no lemma)", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Root", lemma: "hand", surf: "hand" },
				"German",
			),
		).toBe("[[hand]]");
	});

	it("formats morpheme with Separable tag", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Prefix", surf: "auf", tags: ["Separable"] },
				"German",
			),
		).toBe("[[auf|>auf]]");
	});

	it("formats morpheme with Inseparable tag", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Prefix", surf: "ver", tags: ["Inseparable"] },
				"German",
			),
		).toBe("[[ver|ver<]]");
	});

	it("formats morpheme with both lemma and tags", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Prefix", lemma: "auf-", surf: "auf", tags: ["Separable"] },
				"German",
			),
		).toBe("[[auf-|>auf]]");
	});

	it("ignores tags for English", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Prefix", surf: "un", tags: ["Separable"] },
				"English",
			),
		).toBe("[[un]]");
	});
});

describe("morphemeFormatterHelper.formatSection", () => {
	it("formats aufpassen with separable prefix", () => {
		expect(
			morphemeFormatterHelper.formatSection(
				[
					{ kind: "Prefix", surf: "auf", tags: ["Separable"] },
					{ kind: "Root", surf: "passen" },
				],
				"German",
			),
		).toBe("[[auf|>auf]]|[[passen]]");
	});

	it("formats Kohlekraftwerk (simple compound)", () => {
		expect(
			morphemeFormatterHelper.formatSection(
				[
					{ kind: "Root", surf: "kohle" },
					{ kind: "Root", surf: "kraft" },
					{ kind: "Root", surf: "werk" },
				],
				"German",
			),
		).toBe("[[kohle]]|[[kraft]]|[[werk]]");
	});

	it("formats verstehen with inseparable prefix", () => {
		expect(
			morphemeFormatterHelper.formatSection(
				[
					{ kind: "Prefix", surf: "ver", tags: ["Inseparable"] },
					{ kind: "Root", surf: "stehen" },
				],
				"German",
			),
		).toBe("[[ver|ver<]]|[[stehen]]");
	});

	it("formats single morpheme", () => {
		expect(
			morphemeFormatterHelper.formatSection(
				[{ kind: "Root", surf: "hand" }],
				"German",
			),
		).toBe("[[hand]]");
	});

	it("formats with lemma and tags combined", () => {
		expect(
			morphemeFormatterHelper.formatSection(
				[
					{ kind: "Root", lemma: "sing", surf: "sang" },
					{ kind: "Suffix", surf: "er" },
				],
				"German",
			),
		).toBe("[[sing|sang]]|[[er]]");
	});
});
