import { describe, expect, it } from "bun:test";
import {
	buildEnglishWalkLemma,
	buildGermanFeminineSeeLemma,
	type LingIdSurfaceInput,
	parseGermanSurface,
	toGermanShallowSurfaceLingId,
	toGermanSurfaceLingId,
} from "./ling-id-test-helpers";

describe("Ling ID guardrails", () => {
	it("rejects nested full target lemmas with a mismatched language", () => {
		const malformedSurface = {
			language: "German",
			orthographicStatus: "Standard",
			spelledSelection: "walk",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
				normalizedFullSurface: "walk",
				surfaceKind: "Lemma",
				target: buildEnglishWalkLemma(),
			},
		} satisfies LingIdSurfaceInput<"German">;

		expect(() => toGermanSurfaceLingId(malformedSurface)).toThrow(
			/Ling ID builder language mismatch/,
		);
	});

	it("accepts resolved surfaces and rejects lemma input in the shallow surface serializer", () => {
		const lemma = buildGermanFeminineSeeLemma();
		const resolvedSurface = parseGermanSurface(
			toGermanSurfaceLingId(lemma),
		);

		expect(() =>
			toGermanShallowSurfaceLingId(
				lemma as unknown as LingIdSurfaceInput<"German">,
			),
		).toThrow(/surface input/);
		expect(toGermanShallowSurfaceLingId(resolvedSurface)).toBe(
			"ling:v1:DE:SURF-SHALLOW;See;Standard;Lemma;Lexeme;NOUN;-",
		);
	});

	it("does not preserve compatibility with the removed top-level lemma format", () => {
		expect(() =>
			parseGermanSurface("ling:v1:DE:LEM;See;Lexeme;NOUN;gender=Fem;-"),
		).toThrow(/Unsupported Ling ID kind: LEM/);
	});
});
