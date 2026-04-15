import { describe, expect, it } from "bun:test";
import type { ParsedShallowSurfaceDto } from "../../src";
import {
	buildEnglishWalkLemma,
	buildGermanFeminineSeeLemma,
	buildGermanNeuterSeeLemma,
	germanLingConverters,
	type LingIdSurfaceInput,
	parseEnglishShallowSurface,
	parseEnglishSurface,
	toEnglishShallowSurfaceLingId,
	toEnglishSurfaceLingId,
	toGermanShallowSurfaceLingId,
	toGermanSurfaceLingId,
} from "./ling-id/ling-id-test-helpers";

describe("Ling ID usage", () => {
	it("implements the required See ambiguity matrix", () => {
		const feminineSeeLemma = buildGermanFeminineSeeLemma();
		const neuterSeeLemma = buildGermanNeuterSeeLemma();

		const shallowSurface = {
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
				},
			},
		} satisfies LingIdSurfaceInput<"German">;

		const fullFemSurface = {
			...shallowSurface,
			surface: {
				...shallowSurface.surface,
				target: feminineSeeLemma,
			},
		} satisfies LingIdSurfaceInput<"German">;

		const sameFullFemSurface = {
			...shallowSurface,
			surface: {
				...shallowSurface.surface,
				target: feminineSeeLemma,
			},
		} satisfies LingIdSurfaceInput<"German">;

		const fullNeuterSurface = {
			...shallowSurface,
			surface: {
				...shallowSurface.surface,
				target: neuterSeeLemma,
			},
		} satisfies LingIdSurfaceInput<"German">;

		const observedFemSurface = toGermanSurfaceLingId(feminineSeeLemma);

		const observedNeuterSurface = toGermanSurfaceLingId(neuterSeeLemma);

		expect(toGermanSurfaceLingId(fullFemSurface)).toBe(
			toGermanSurfaceLingId(sameFullFemSurface),
		);
		expect(toGermanSurfaceLingId(fullFemSurface)).not.toBe(
			toGermanSurfaceLingId(fullNeuterSurface),
		);
		expect(toGermanSurfaceLingId(shallowSurface)).toBe(
			toGermanSurfaceLingId({
				...shallowSurface,
				surface: {
					...shallowSurface.surface,
					target: {
						canonicalLemma: "See",
					},
				},
			}),
		);
		expect(toGermanSurfaceLingId(shallowSurface)).not.toBe(
			toGermanSurfaceLingId(fullFemSurface),
		);
		expect(observedFemSurface).not.toBe(observedNeuterSurface);

		const shallowIds = [
			toGermanShallowSurfaceLingId(shallowSurface),
			toGermanShallowSurfaceLingId(fullFemSurface),
			toGermanShallowSurfaceLingId(sameFullFemSurface),
			toGermanShallowSurfaceLingId(fullNeuterSurface),
		];

		expect(new Set(shallowIds).size).toBe(1);
	});

	it("supports the convenience dispatcher with observed-surface semantics", () => {
		const lemma = buildGermanFeminineSeeLemma();

		const surface = {
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
				},
			},
		} satisfies LingIdSurfaceInput<"German">;

		expect(germanLingConverters.getSurfaceLingId(lemma)).toBe(
			toGermanSurfaceLingId(lemma),
		);
		expect(germanLingConverters.getSurfaceLingId(surface)).toBe(
			toGermanSurfaceLingId(surface),
		);
	});

	it("round-trips targeted inflections across full and shallow builder methods", () => {
		const walkLemma = buildEnglishWalkLemma();

		const walkSurface = {
			language: "English",
			orthographicStatus: "Standard",
			spelledSelection: "walked",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
				inflectionalFeatures: {
					tense: "Past",
					verbForm: "Fin",
				},
				normalizedFullSurface: "walked",
				surfaceKind: "Inflection",
				target: walkLemma,
			},
		} satisfies LingIdSurfaceInput<"English">;

		const fullId = toEnglishSurfaceLingId(walkSurface);
		const parsedFullSurface = parseEnglishSurface(fullId);
		const shallowIdFromSurface = toEnglishShallowSurfaceLingId(walkSurface);
		const shallowIdFromParsedFull =
			toEnglishShallowSurfaceLingId(parsedFullSurface);
		const parsedShallowSurface =
			parseEnglishShallowSurface(shallowIdFromSurface);

		expect(toEnglishSurfaceLingId(parsedFullSurface)).toBe(fullId);
		expect(shallowIdFromParsedFull).toBe(shallowIdFromSurface);
		expect(parsedShallowSurface).toEqual({
			language: "English",
			orthographicStatus: "Standard",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
				inflectionalFeatures: {
					tense: "Past",
					verbForm: "Fin",
				},
				normalizedFullSurface: "walked",
				surfaceKind: "Inflection",
			},
		});
		expect(
			toEnglishShallowSurfaceLingId(
				parsedShallowSurface as ParsedShallowSurfaceDto,
			),
		).toBe(shallowIdFromSurface);
	});
});
