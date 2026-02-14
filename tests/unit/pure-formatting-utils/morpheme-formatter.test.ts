import { describe, expect, it } from "bun:test";
import { morphemeFormatterHelper } from "../../../src/stateless-helpers/morpheme-formatter";

describe("morphemeFormatterHelper.decorateSurface", () => {
	it("returns raw surf when no separability", () => {
		expect(morphemeFormatterHelper.decorateSurface("auf", undefined, "German")).toBe("auf");
	});

	it("decorates German Separable prefix with >", () => {
		expect(
			morphemeFormatterHelper.decorateSurface("auf", "Separable", "German"),
		).toBe(">auf");
	});

	it("decorates German Inseparable prefix with <", () => {
		expect(
			morphemeFormatterHelper.decorateSurface("ver", "Inseparable", "German"),
		).toBe("ver<");
	});

	it("ignores separability for English", () => {
		expect(
			morphemeFormatterHelper.decorateSurface("auf", "Separable", "English"),
		).toBe("auf");
	});

	it("ignores Inseparable for English", () => {
		expect(
			morphemeFormatterHelper.decorateSurface("ver", "Inseparable", "English"),
		).toBe("ver");
	});
});

describe("morphemeFormatterHelper.formatAsWikilink", () => {
	it("formats simple morpheme (no lemma, no separability)", () => {
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

	it("formats morpheme with Separable separability (no decoration in section)", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Prefix", separability: "Separable", surf: "auf" },
				"German",
			),
		).toBe("[[auf]]");
	});

	it("formats morpheme with Inseparable separability (no decoration in section)", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Prefix", separability: "Inseparable", surf: "ver" },
				"German",
			),
		).toBe("[[ver]]");
	});

	it("formats morpheme with both lemma and separability", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Prefix", lemma: "auf-", separability: "Separable", surf: "auf" },
				"German",
			),
		).toBe("[[auf-|auf]]");
	});

	it("ignores separability for English", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Prefix", separability: "Separable", surf: "un" },
				"English",
			),
		).toBe("[[un]]");
	});

	it("formats prefix with linkTarget (no decoration in section)", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Prefix", linkTarget: "ver-prefix-de", separability: "Inseparable", surf: "ver" },
				"German",
			),
		).toBe("[[ver-prefix-de|ver]]");
	});

	it("formats root with lemma (no linkTarget)", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Root", lemma: "Taube", surf: "täub" },
				"German",
			),
		).toBe("[[Taube|täub]]");
	});

	it("skips alias when lemma differs only in case", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Root", lemma: "Hand", surf: "hand" },
				"German",
			),
		).toBe("[[Hand]]");
	});

	it("linkTarget overrides lemma for target (no decoration in section)", () => {
		expect(
			morphemeFormatterHelper.formatAsWikilink(
				{ kind: "Prefix", linkTarget: "auf-prefix-de", separability: "Separable", surf: "auf" },
				"German",
			),
		).toBe("[[auf-prefix-de|auf]]");
	});
});

describe("morphemeFormatterHelper.formatSection", () => {
	it("formats aufpassen with separable prefix (no decoration in section)", () => {
		expect(
			morphemeFormatterHelper.formatSection(
				[
					{ kind: "Prefix", separability: "Separable", surf: "auf" },
					{ kind: "Root", surf: "passen" },
				],
				"German",
			),
		).toBe("[[auf]]|[[passen]]");
	});

	it("formats Kohlekraftwerk (simple compound with noun lemmas)", () => {
		expect(
			morphemeFormatterHelper.formatSection(
				[
					{ kind: "Root", lemma: "Kohle", surf: "kohle" },
					{ kind: "Root", lemma: "Kraft", surf: "kraft" },
					{ kind: "Root", lemma: "Werk", surf: "werk" },
				],
				"German",
			),
		).toBe("[[Kohle]]|[[Kraft]]|[[Werk]]");
	});

	it("formats verstehen with inseparable prefix (no decoration in section)", () => {
		expect(
			morphemeFormatterHelper.formatSection(
				[
					{ kind: "Prefix", separability: "Inseparable", surf: "ver" },
					{ kind: "Root", surf: "stehen" },
				],
				"German",
			),
		).toBe("[[ver]]|[[stehen]]");
	});

	it("formats single morpheme", () => {
		expect(
			morphemeFormatterHelper.formatSection(
				[{ kind: "Root", surf: "hand" }],
				"German",
			),
		).toBe("[[hand]]");
	});

	it("formats with lemma and separability combined", () => {
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

	it("formats Turteltäubchen with lemma on root", () => {
		expect(
			morphemeFormatterHelper.formatSection(
				[
					{ kind: "Root", surf: "turtel" },
					{ kind: "Root", lemma: "Taube", surf: "täub" },
					{ kind: "Suffix", surf: "chen" },
				],
				"German",
			),
		).toBe("[[turtel]]|[[Taube|täub]]|[[chen]]");
	});

	it("formats Küchenfenster with Fugenlaut", () => {
		expect(
			morphemeFormatterHelper.formatSection(
				[
					{ kind: "Root", lemma: "Küche", surf: "küche" },
					{ kind: "Interfix", surf: "n" },
					{ kind: "Root", lemma: "Fenster", surf: "fenster" },
				],
				"German",
			),
		).toBe("[[Küche]]|[[n]]|[[Fenster]]");
	});

	it("formats aufpassen with linkTarget on prefix (no decoration in section)", () => {
		expect(
			morphemeFormatterHelper.formatSection(
				[
					{ kind: "Prefix", linkTarget: "auf-prefix-de", separability: "Separable", surf: "auf" },
					{ kind: "Root", surf: "passen" },
				],
				"German",
			),
		).toBe("[[auf-prefix-de|auf]]|[[passen]]");
	});
});
