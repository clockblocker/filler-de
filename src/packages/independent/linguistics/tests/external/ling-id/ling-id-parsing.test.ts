import { describe, expect, it } from "bun:test";
import type { Lemma, ParsedShallowSurfaceDto } from "../../../src";
import { ResolvedSurfaceSchema, SelectionSchema } from "../../../src";
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
	it("round-trips resolved surface ids as plain resolved surfaces", () => {
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
			throw new Error("Expected a resolved surface");
		}

		const resolved = parsed as typeof parsed & {
			target: { lemmaKind: string };
		};

		expect(resolved.target.lemmaKind).toBe("Morpheme");
		expect(resolved as unknown).toEqual({
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
		expect(JSON.parse(JSON.stringify(resolved))).toEqual(resolved);
		expect(structuredClone(resolved)).toEqual(resolved);
		expect(toGermanSurfaceLingId(resolved)).toBe(id);
		expect(
			ResolvedSurfaceSchema.German.Standard.Lemma.Morpheme.Prefix.safeParse(
				resolved,
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

	it("round-trips resolved lemma identities through the builder parsers", () => {
		const observedId = toEnglishSurfaceLingId(buildEnglishWalkLemma());
		const parsedResolvedSurface = parseEnglishSurface(observedId);

		if (!("target" in parsedResolvedSurface)) {
			throw new Error("Expected a resolved surface");
		}
		const shallowId = toEnglishShallowSurfaceLingId(parsedResolvedSurface);
		const parsedShallowSurface = parseEnglishShallowSurface(shallowId);

		expect(toEnglishSurfaceLingId(parsedResolvedSurface)).toBe(observedId);
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
		const parsedResolved = parseEnglishSurface(
			observedId,
		) as ParsedSurface<"English">;

		expect(toEnglishSurfaceLingId(parsedTargeted)).toBe(targetedId);
		expect(toEnglishSurfaceLingId(parsedResolved)).toBe(observedId);
	});
});
