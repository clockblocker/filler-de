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

		const shallowSurface: LingIdSurfaceInput<"German"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			normalizedFullSurface: "See",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: {
				canonicalLemma: "See",
			},
		};

		const fullFemSurface: LingIdSurfaceInput<"German"> = {
			...shallowSurface,
			target: feminineSeeLemma,
		};

		const sameFullFemSurface: LingIdSurfaceInput<"German"> = {
			...shallowSurface,
			target: feminineSeeLemma,
		};

		const fullNeuterSurface: LingIdSurfaceInput<"German"> = {
			...shallowSurface,
			target: neuterSeeLemma,
		};

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
				target: {
					canonicalLemma: "See",
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

		const surface: LingIdSurfaceInput<"German"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			normalizedFullSurface: "See",
			orthographicStatus: "Standard",
			surfaceKind: "Lemma",
			target: {
				canonicalLemma: "See",
			},
		};

		expect(germanLingConverters.getSurfaceLingId(lemma)).toBe(
			toGermanSurfaceLingId(lemma),
		);
		expect(germanLingConverters.getSurfaceLingId(surface)).toBe(
			toGermanSurfaceLingId(surface),
		);
	});

	it("round-trips targeted inflections across full and shallow builder methods", () => {
		const walkLemma = buildEnglishWalkLemma();

		const walkSurface: LingIdSurfaceInput<"English"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			inflectionalFeatures: {
				tense: "Past",
				verbForm: "Fin",
			},
			normalizedFullSurface: "walked",
			orthographicStatus: "Standard",
			surfaceKind: "Inflection",
			target: walkLemma,
		};

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
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			inflectionalFeatures: {
				tense: "Past",
				verbForm: "Fin",
			},
			language: "English",
			lingKind: "Surface",
			normalizedFullSurface: "walked",
			orthographicStatus: "Standard",
			surfaceKind: "Inflection",
		});
		expect(
			toEnglishShallowSurfaceLingId(
				parsedShallowSurface as ParsedShallowSurfaceDto,
			),
		).toBe(shallowIdFromSurface);
	});
});
