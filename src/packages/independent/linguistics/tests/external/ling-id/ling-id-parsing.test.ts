import { describe, expect, it } from "bun:test";
import type { Lemma, ParsedShallowSurfaceDto } from "../../../src";
import { ObservedSurfaceSchema, SelectionSchema } from "../../../src";
import {
	buildEnglishWalkLemma,
	buildGermanFeminineSeeLemma,
	type LingIdSurfaceInput,
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
	it("round-trips observed surface ids as plain observed surfaces", () => {
		const morpheme = {
			canonicalLemma: "ab-",
			isClosedSet: false,
			language: "German",
			lemmaKind: "Morpheme",
			meaningInEmojis: "🧩",
			morphemeKind: "Prefix",
			separable: "Yes",
		} satisfies Lemma<"German", "Morpheme", "Prefix">;

		const id = toGermanSurfaceLingId(morpheme);
		const parsed = parseGermanSurface(id);

		if (!("target" in parsed)) {
			throw new Error("Expected an observed surface");
		}

		const observed = parsed as typeof parsed & {
			target: { lemmaKind: string };
		};

		expect(observed.target.lemmaKind).toBe("Morpheme");
		expect(observed as unknown).toEqual({
			discriminators: {
				lemmaKind: "Morpheme",
				lemmaSubKind: "Prefix",
			},
			normalizedFullSurface: "ab-",
			surfaceKind: "Lemma",
			target: {
				canonicalLemma: "ab-",
				isClosedSet: false,
				language: "German",
				lemmaKind: "Morpheme",
				meaningInEmojis: "🧩",
				morphemeKind: "Prefix",
				separable: "Yes",
			},
		});
		expect(JSON.parse(JSON.stringify(observed))).toEqual(observed);
		expect(structuredClone(observed)).toEqual(observed);
		expect(toGermanSurfaceLingId(observed)).toBe(id);
		expect(
			ObservedSurfaceSchema.German.Standard.Lemma.Morpheme.Prefix.safeParse(
				observed,
			).success,
		).toBe(true);
	});

	it("round-trips targeted surface ids as selections and preserves target branches", () => {
		const fullSurface = {
			language: "German",
			orthographicStatus: "Standard",
			spelledSelection: "See",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				normalizedFullSurface: "See",
				surfaceKind: "Lemma",
				target: buildGermanFeminineSeeLemma(),
			},
		} satisfies LingIdSurfaceInput<"German">;

		const shallowSurface = {
			...fullSurface,
			surface: {
				...fullSurface.surface,
				target: {
					canonicalLemma: "See",
				},
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

		expect("lemmaKind" in parsedFull.surface.target).toBe(true);
		if ("lemmaKind" in parsedFull.surface.target) {
			expect(parsedFull.surface.target.canonicalLemma).toBe("See");
		}
		expect("canonicalLemma" in parsedShallow.surface.target).toBe(true);
		expect(parsedFull).toEqual({
			language: "German",
			orthographicStatus: "Standard",
			spelledSelection: "See",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				normalizedFullSurface: "See",
				surfaceKind: "Lemma",
				target: {
					canonicalLemma: "See",
					inherentFeatures: {
						gender: "Fem",
					},
					language: "German",
					lemmaKind: "Lexeme",
					meaningInEmojis: "🌊",
					pos: "NOUN",
				},
			},
		});
		expect(JSON.parse(JSON.stringify(parsedFull))).toEqual(parsedFull);
		expect(structuredClone(parsedFull)).toEqual(parsedFull);
		expect(toGermanSurfaceLingId(parsedFull)).toBe(fullId);
		expect(toGermanSurfaceLingId(parsedShallow)).toBe(shallowId);
		expect(
			SelectionSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse(
				parsedFull,
			).success,
		).toBe(true);
		expect(
			SelectionSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse(
				parsedShallow,
			).success,
		).toBe(true);
		expect(
			SelectionSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse({
				...parsedFull,
				language: "English",
			}).success,
		).toBe(false);
		expect(
			SelectionSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse({
				...parsedFull,
				orthographicStatus: "Typo",
			}).success,
		).toBe(false);
	});

	it("round-trips observed lemma identities through the builder parsers", () => {
		const observedId = toEnglishSurfaceLingId(buildEnglishWalkLemma());
		const parsedObservedSurface = parseEnglishSurface(observedId);

		if (!("target" in parsedObservedSurface)) {
			throw new Error("Expected an observed surface");
		}
		const shallowId = toEnglishShallowSurfaceLingId(parsedObservedSurface);
		const parsedShallowSurface = parseEnglishShallowSurface(shallowId);

		expect(toEnglishSurfaceLingId(parsedObservedSurface)).toBe(observedId);
		expect(shallowId).toBe(
			"ling:v1:EN:SURF-SHALLOW;walk;Standard;Lemma;Lexeme;VERB;-",
		);
		expect(parsedShallowSurface).toEqual({
			language: "English",
			orthographicStatus: "Standard",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
				normalizedFullSurface: "walk",
				surfaceKind: "Lemma",
			},
		});
		expect(
			toEnglishShallowSurfaceLingId(
				parsedShallowSurface as ParsedShallowSurfaceDto,
			),
		).toBe(shallowId);
	});

	it("round-trips shallow surface ids as nested surface shells", () => {
		const shallowId =
			"ling:v1:DE:SURF-SHALLOW;See;Standard;Lemma;Lexeme;NOUN;-";
		const parsedShallowSurface = parseGermanShallowSurface(
			shallowId,
		) as ParsedShallowSurfaceDto;

		expect(parsedShallowSurface).toEqual({
			language: "German",
			orthographicStatus: "Standard",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "NOUN",
				},
				normalizedFullSurface: "See",
				surfaceKind: "Lemma",
			},
		});
		expect(toGermanShallowSurfaceLingId(parsedShallowSurface)).toBe(
			shallowId,
		);
	});

	it("parses reserialized values across both surface branches", () => {
		const targetedId =
			"ling:v1:EN:SURF;walk;Standard;Lemma;Lexeme;VERB;-;canon;walk";
		const observedId =
			"ling:v1:EN:SURF;walk;Standard;Lemma;Lexeme;VERB;-;observed;walk;Lexeme;VERB;-;🚶";
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
