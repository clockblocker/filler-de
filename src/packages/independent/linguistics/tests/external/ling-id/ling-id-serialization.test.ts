import { describe, expect, it } from "bun:test";
import type { Lemma } from "../../../src";
import {
	buildEnglishWalkLemma,
	buildGermanFeminineSeeLemma,
	buildGermanNeuterSeeLemma,
	type LingIdSurfaceInput,
	parseGermanSurface,
	toEnglishShallowSurfaceLingId,
	toEnglishSurfaceLingId,
	toGermanShallowSurfaceLingId,
	toGermanSurfaceLingId,
} from "./ling-id-test-helpers";

describe("Ling ID serialization", () => {
	it("serializes lemma input as observed surface identity", () => {
		const separableVerb = {
			canonicalLemma: "untergehen",
			inherentFeatures: {
				separable: "Yes",
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🌅",
			pos: "VERB",
		} satisfies Lemma<"German", "Lexeme", "VERB">;

		const verbWithoutSeparable = {
			...separableVerb,
			inherentFeatures: {
				separable: undefined,
			},
		} satisfies Lemma<"German", "Lexeme", "VERB">;

		const feminineSee = buildGermanFeminineSeeLemma();
		const neuterSee = buildGermanNeuterSeeLemma();

		const prefixWithSeparable = {
			canonicalLemma: "ab-",
			language: "German",
			lemmaKind: "Morpheme",
			meaningInEmojis: "🧩",
			morphemeKind: "Prefix",
			separable: "Yes",
		} satisfies Lemma<"German", "Morpheme", "Prefix">;

		const prefixWithoutSeparable = {
			...prefixWithSeparable,
			separable: undefined,
		} satisfies Lemma<"German", "Morpheme", "Prefix">;

		expect(toGermanSurfaceLingId(separableVerb)).toBe(
			"ling:v1:DE:SURF;untergehen;Standard;Lemma;Lexeme;VERB;-;observed;untergehen;Lexeme;VERB;separable=Yes;🌅",
		);
		expect(toGermanSurfaceLingId(verbWithoutSeparable)).toBe(
			"ling:v1:DE:SURF;untergehen;Standard;Lemma;Lexeme;VERB;-;observed;untergehen;Lexeme;VERB;-;🌅",
		);
		expect(toGermanSurfaceLingId(separableVerb)).not.toBe(
			toGermanSurfaceLingId(verbWithoutSeparable),
		);
		expect(toGermanSurfaceLingId(feminineSee)).not.toBe(
			toGermanSurfaceLingId(neuterSee),
		);
		expect(toGermanSurfaceLingId(prefixWithSeparable)).toBe(
			"ling:v1:DE:SURF;ab%2D;Standard;Lemma;Morpheme;Prefix;-;observed;ab%2D;Morpheme;Prefix;separable=Yes;🧩",
		);
		expect(toGermanSurfaceLingId(prefixWithSeparable)).not.toBe(
			toGermanSurfaceLingId(prefixWithoutSeparable),
		);
		expect(toEnglishSurfaceLingId(buildEnglishWalkLemma())).toBe(
			"ling:v1:EN:SURF;walk;Standard;Lemma;Lexeme;VERB;-;observed;walk;Lexeme;VERB;-;🚶",
		);
	});

	it("serializes targeted selections with nested lemma payloads and sorted inflectional features", () => {
		const fullSurface = {
			language: "English",
			orthographicStatus: "Standard",
			spelledSelection: "walk",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
				inflectionalFeatures: {
					tense: "Pres",
					verbForm: "Fin",
				},
				normalizedFullSurface: "walk",
				surfaceKind: "Inflection",
				target: buildEnglishWalkLemma(),
			},
		} satisfies LingIdSurfaceInput<"English">;

		const shallowSurface = {
			...fullSurface,
			surface: {
				...fullSurface.surface,
				target: {
					canonicalLemma: "walk",
				},
			},
		} satisfies LingIdSurfaceInput<"English">;

		const lemmaSurface = {
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

		const fullSurfaceId = toEnglishSurfaceLingId(fullSurface);

		expect(fullSurfaceId).toBe(
			"ling:v1:EN:SURF;walk;Standard;Inflection;Lexeme;VERB;tense=Pres,verbForm=Fin;lemma;walk;Lexeme;VERB;-;🚶",
		);
		expect(toEnglishSurfaceLingId(shallowSurface)).not.toBe(fullSurfaceId);
		expect(fullSurfaceId.split(";lemma;")[1]).toBe("walk;Lexeme;VERB;-;🚶");
		expect(toGermanSurfaceLingId(lemmaSurface)).toBe(
			"ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;canon;See",
		);
	});

	it("keeps shallow surface ids stable across target richness but sensitive to shell changes", () => {
		const canonicalSurface = {
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

		const feminineSurface = {
			...canonicalSurface,
			surface: {
				...canonicalSurface.surface,
				target: buildGermanFeminineSeeLemma(),
			},
		} satisfies LingIdSurfaceInput<"German">;

		const neuterSurface = {
			...canonicalSurface,
			surface: {
				...canonicalSurface.surface,
				target: buildGermanNeuterSeeLemma(),
			},
		} satisfies LingIdSurfaceInput<"German">;

		const walkPres = {
			language: "English",
			orthographicStatus: "Standard",
			spelledSelection: "walked",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
				inflectionalFeatures: {
					tense: "Pres",
					verbForm: "Fin",
				},
				normalizedFullSurface: "walk",
				surfaceKind: "Inflection",
				target: {
					canonicalLemma: "walk",
				},
			},
		} satisfies LingIdSurfaceInput<"English">;

		const walkPast = {
			...walkPres,
			surface: {
				...walkPres.surface,
				inflectionalFeatures: {
					tense: "Past",
					verbForm: "Fin",
				},
			},
		} satisfies LingIdSurfaceInput<"English">;

		expect(toGermanShallowSurfaceLingId(canonicalSurface)).toBe(
			toGermanShallowSurfaceLingId(feminineSurface),
		);
		expect(toGermanShallowSurfaceLingId(feminineSurface)).toBe(
			toGermanShallowSurfaceLingId(neuterSurface),
		);
		expect(toEnglishShallowSurfaceLingId(walkPres)).not.toBe(
			toEnglishShallowSurfaceLingId(walkPast),
		);
	});

	it("canonicalizes observed surface shells on reserialization", () => {
		const observed = parseGermanSurface(
			"ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;observed;See;Lexeme;NOUN;gender=Fem;-",
		);

		if (!("target" in observed)) {
			throw new Error("Expected an observed surface");
		}

		const mutatedObserved = {
			...observed,
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			normalizedFullSurface: "Bogus",
		};

		expect(toGermanSurfaceLingId(mutatedObserved)).toBe(
			"ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;observed;See;Lexeme;NOUN;gender=Fem;-",
		);
	});
});
