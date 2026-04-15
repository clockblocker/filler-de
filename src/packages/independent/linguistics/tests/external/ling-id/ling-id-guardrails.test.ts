import { describe, expect, it } from "bun:test";
import type { ParsedObservedSurfaceDto } from "../../../src";
import {
	buildEnglishWalkLemma,
	buildGermanFeminineSeeLemma,
	type LingIdSurfaceInput,
	type ParsedTargetedSurface,
	parseGermanSurface,
	toGermanShallowSurfaceLingId,
	toGermanSurfaceLingId,
} from "./ling-id-test-helpers";

describe("Ling ID guardrails", () => {
	it("rejects nested full target lemmas with a mismatched language", () => {
		const malformedSurface = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			normalizedFullSurface: "walk",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: buildEnglishWalkLemma(),
		} satisfies LingIdSurfaceInput<"German">;

		expect(() => toGermanSurfaceLingId(malformedSurface)).toThrow(
			/Ling ID builder language mismatch/,
		);
	});

	it("accepts observed surfaces and rejects lemma input in the shallow surface serializer", () => {
		const lemma = buildGermanFeminineSeeLemma();
		const observedSurface = parseGermanSurface(
			toGermanSurfaceLingId(lemma),
		) as ParsedObservedSurfaceDto;

		expect(() =>
			toGermanShallowSurfaceLingId(
				lemma as unknown as LingIdSurfaceInput<"German">,
			),
		).toThrow(/surface input/);
		expect(
			toGermanShallowSurfaceLingId(
				observedSurface as unknown as ParsedTargetedSurface<"German">,
			),
		).toBe("ling:v1:DE:SURF-SHALLOW;See;Standard;Lemma;Lexeme;NOUN;-");
	});

	it("does not preserve compatibility with the removed top-level lemma format", () => {
		expect(() =>
			parseGermanSurface("ling:v1:DE:LEM;See;Lexeme;NOUN;gender=Fem;-"),
		).toThrow(/Unsupported Ling ID kind: LEM/);
	});
});
