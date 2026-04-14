import { describe, expect, it } from "bun:test";
import type { Lemma, ParsedObservedSurfaceDto } from "../../../src";
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
				separable: true,
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🌅",
			pos: "VERB",
		} satisfies Lemma<"German", "Lexeme", "VERB">;

		const inseparableVerb = {
			...separableVerb,
			inherentFeatures: {
				separable: false,
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
			separable: true,
		} satisfies Lemma<"German", "Morpheme", "Prefix">;

		const prefixWithoutSeparable = {
			...prefixWithSeparable,
			separable: undefined,
		} satisfies Lemma<"German", "Morpheme", "Prefix">;

		expect(toGermanSurfaceLingId(separableVerb)).toBe(
			"ling:v1:DE:SURF;untergehen;Standard;Lemma;Lexeme;VERB;-;observed;untergehen;Lexeme;VERB;separable=Yes;🌅",
		);
		expect(toGermanSurfaceLingId(inseparableVerb)).toBe(
			"ling:v1:DE:SURF;untergehen;Standard;Lemma;Lexeme;VERB;-;observed;untergehen;Lexeme;VERB;separable=No;🌅",
		);
		expect(toGermanSurfaceLingId(separableVerb)).not.toBe(
			toGermanSurfaceLingId(inseparableVerb),
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

	it("serializes targeted surface identity with nested lemma payloads and sorted inflectional features", () => {
		const fullSurface: LingIdSurfaceInput<"English"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			inflectionalFeatures: {
				tense: "Pres",
				verbForm: "Fin",
			},
			normalizedFullSurface: "walk",
			orthographicStatus: "Standard",
			surfaceKind: "Inflection",
			target: buildEnglishWalkLemma(),
		};

		const shallowSurface: LingIdSurfaceInput<"English"> = {
			...fullSurface,
			target: {
				canonicalLemma: "walk",
			},
		};

		const lemmaSurface: LingIdSurfaceInput<"German"> = {
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
		const canonicalSurface: LingIdSurfaceInput<"German"> = {
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

		const feminineSurface: LingIdSurfaceInput<"German"> = {
			...canonicalSurface,
			target: buildGermanFeminineSeeLemma(),
		};

		const neuterSurface: LingIdSurfaceInput<"German"> = {
			...canonicalSurface,
			target: buildGermanNeuterSeeLemma(),
		};

		const walkPres: LingIdSurfaceInput<"English"> = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			inflectionalFeatures: {
				tense: "Pres",
				verbForm: "Fin",
			},
			normalizedFullSurface: "walk",
			orthographicStatus: "Standard",
			surfaceKind: "Inflection",
			target: {
				canonicalLemma: "walk",
			},
		};

		const walkPast: LingIdSurfaceInput<"English"> = {
			...walkPres,
			inflectionalFeatures: {
				tense: "Past",
				verbForm: "Fin",
			},
		};

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

	it("canonicalizes observed surface dto shells on reserialization", () => {
		const observed = parseGermanSurface(
			"ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;observed;See;Lexeme;NOUN;gender=Fem;-",
		) as ParsedObservedSurfaceDto;

		const mutatedObserved: ParsedObservedSurfaceDto = {
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
