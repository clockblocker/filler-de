import { describe, expect, it } from "bun:test";
import type {
	Lemma,
	ParsedObservedSurfaceDto,
	ParsedShallowSurfaceDto,
} from "../../../src";
import { SurfaceSchema } from "../../../src";
import {
	buildEnglishWalkLemma,
	buildGermanFeminineSeeLemma,
	type LingIdSurfaceInput,
	type ParsedObservedSurface,
	type ParsedSurface,
	type ParsedTargetedSurface,
	parseEnglishShallowSurface,
	parseEnglishSurface,
	parseGermanShallowSurface,
	parseGermanSurface,
	toEnglishShallowSurfaceLingId,
	toEnglishSurfaceLingId,
	toGermanShallowSurfaceLingId,
	toGermanSurfaceLingId,
} from "./ling-id-test-helpers";

describe("Ling ID parsing", () => {
	it("round-trips observed surface ids as plain dto objects", () => {
		const morpheme = {
			canonicalLemma: "ab-",
			isClosedSet: false,
			language: "German",
			lemmaKind: "Morpheme",
			meaningInEmojis: "🧩",
			morphemeKind: "Prefix",
			separable: true,
		} satisfies Lemma<"German", "Morpheme", "Prefix">;

		const id = toGermanSurfaceLingId(morpheme);
		const parsed = parseGermanSurface(
			id,
		) as ParsedObservedSurface<"German">;

		expect(parsed.observationMode).toBe("observed");
		expect(parsed.target.lemmaKind).toBe("Morpheme");
		expect({ ...parsed }).toEqual({
			discriminators: {
				lemmaKind: "Morpheme",
				lemmaSubKind: "Prefix",
			},
			language: "German",
			lingKind: "Surface",
			normalizedFullSurface: "ab-",
			observationMode: "observed",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: {
				canonicalLemma: "ab-",
				isClosedSet: false,
				language: "German",
				lemmaKind: "Morpheme",
				lingKind: "Lemma",
				meaningInEmojis: "🧩",
				morphemeKind: "Prefix",
				separable: true,
			},
		});
		expect(JSON.parse(JSON.stringify(parsed))).toEqual({ ...parsed });
		expect(structuredClone(parsed)).toEqual(parsed);
		expect(toGermanSurfaceLingId(parsed)).toBe(id);
		expect(
			SurfaceSchema.German.Standard.Lemma.Morpheme.Prefix.safeParse(
				parsed,
			).success,
		).toBe(false);
	});

	it("round-trips targeted surface ids as plain dto objects and preserves target branches", () => {
		const fullSurface = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			normalizedFullSurface: "See",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: buildGermanFeminineSeeLemma(),
		} satisfies LingIdSurfaceInput<"German">;

		const shallowSurface = {
			...fullSurface,
			target: {
				canonicalLemma: "See",
			},
		} satisfies LingIdSurfaceInput<"German">;

		const fullId = toGermanSurfaceLingId(fullSurface);
		const shallowId = toGermanSurfaceLingId(shallowSurface);
		const parsedFull = parseGermanSurface(
			fullId,
		) as ParsedTargetedSurface<"German">;
		const parsedShallow = parseGermanSurface(
			shallowId,
		) as ParsedTargetedSurface<"German">;

		expect("lemmaKind" in parsedFull.target).toBe(true);
		if ("lemmaKind" in parsedFull.target) {
			expect(parsedFull.target.lingKind).toBe("Lemma");
			expect(parsedFull.target.canonicalLemma).toBe("See");
		}
		expect("canonicalLemma" in parsedShallow.target).toBe(true);
		expect({ ...parsedFull }).toEqual({
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			language: "German",
			lingKind: "Surface",
			normalizedFullSurface: "See",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: {
				canonicalLemma: "See",
				inherentFeatures: {
					gender: "Fem",
				},
				language: "German",
				lemmaKind: "Lexeme",
				lingKind: "Lemma",
				meaningInEmojis: "🌊",
				pos: "NOUN",
			},
		});
		expect(JSON.parse(JSON.stringify(parsedFull))).toEqual({
			...parsedFull,
		});
		expect(structuredClone(parsedFull)).toEqual(parsedFull);
		expect(toGermanSurfaceLingId(parsedFull)).toBe(fullId);
		expect(toGermanSurfaceLingId(parsedShallow)).toBe(shallowId);
		expect(
			SurfaceSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse(
				parsedFull,
			).success,
		).toBe(true);
		expect(
			SurfaceSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse(
				parsedShallow,
			).success,
		).toBe(true);
		expect(
			SurfaceSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse({
				...parsedFull,
				language: "English",
			}).success,
		).toBe(false);
		expect(
			SurfaceSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse({
				...parsedFull,
				orthographicStatus: "Typo",
			}).success,
		).toBe(false);
		expect(
			SurfaceSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse({
				...parsedFull,
				lingKind: "Lemma",
			}).success,
		).toBe(false);
	});

	it("round-trips observed lemma identities through the builder parsers", () => {
		const observedId = toEnglishSurfaceLingId(buildEnglishWalkLemma());
		const parsedObservedSurface = parseEnglishSurface(
			observedId,
		) as ParsedObservedSurfaceDto;
		const shallowId = toEnglishShallowSurfaceLingId(parsedObservedSurface);
		const parsedShallowSurface = parseEnglishShallowSurface(shallowId);

		expect(toEnglishSurfaceLingId(parsedObservedSurface)).toBe(observedId);
		expect(shallowId).toBe(
			"ling:v1:EN:SURF-SHALLOW;walk;Standard;Lemma;Lexeme;VERB;-",
		);
		expect(parsedShallowSurface).toEqual({
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			language: "English",
			lingKind: "Surface",
			normalizedFullSurface: "walk",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
		});
		expect(
			toEnglishShallowSurfaceLingId(
				parsedShallowSurface as ParsedShallowSurfaceDto,
			),
		).toBe(shallowId);
	});

	it("round-trips shallow surface ids as plain dto objects", () => {
		const shallowId =
			"ling:v1:DE:SURF-SHALLOW;See;Standard;Lemma;Lexeme;NOUN;-";
		const parsedShallowSurface = parseGermanShallowSurface(
			shallowId,
		) as ParsedShallowSurfaceDto;

		expect({ ...parsedShallowSurface }).toEqual({
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			language: "German",
			lingKind: "Surface",
			normalizedFullSurface: "See",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
		});
		expect(toGermanShallowSurfaceLingId(parsedShallowSurface)).toBe(
			shallowId,
		);
	});

	it("parses reserialized dto objects across both surface branches", () => {
		const targetedId =
			"ling:v1:EN:SURF;walk;Standard;Lemma;Lexeme;VERB;-;canon;walk";
		const observedId =
			"ling:v1:EN:SURF;walk;Standard;Lemma;Lexeme;VERB;-;observed;walk;Lexeme;VERB;-;-";
		const parsedTargeted = parseEnglishSurface(
			targetedId,
		) as ParsedSurface<"English">;
		const parsedObserved = parseEnglishSurface(
			observedId,
		) as ParsedSurface<"English">;

		expect(toEnglishSurfaceLingId(parsedTargeted)).toBe(targetedId);
		expect(toEnglishSurfaceLingId(parsedObserved)).toBe(observedId);
	});
});
