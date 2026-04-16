import { describe, expect, it } from "bun:test";
import type { Lemma } from "../../../src";
import {
	buildEnglishWalkLemma,
	buildGermanFeminineSeeLemma,
	buildGermanNeuterSeeLemma,
	buildHebrewKatavLemma,
	type LingIdSurfaceInput,
	parseGermanSurface,
	toEnglishShallowSurfaceLingId,
	toEnglishSurfaceLingId,
	toGermanShallowSurfaceLingId,
	toGermanSurfaceLingId,
	toHebrewSurfaceLingId,
} from "./ling-id-test-helpers";

describe("Ling ID serialization", () => {
	it("serializes lemma input as resolved surface identity", () => {
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
			selectionCoverage: "Full",
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
			selectionCoverage: "Full",
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
			selectionCoverage: "Full",
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
			selectionCoverage: "Full",
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

	it("canonicalizes resolved surface shells on reserialization", () => {
		const resolved = parseGermanSurface(
			"ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;observed;See;Lexeme;NOUN;gender=Fem;-",
		);

		if (!("target" in resolved)) {
			throw new Error("Expected a resolved surface");
		}

		const mutatedResolved = {
			...resolved,
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "VERB",
			},
			normalizedFullSurface: "Bogus",
		} as unknown as Parameters<typeof toGermanSurfaceLingId>[0];

		expect(toGermanSurfaceLingId(mutatedResolved)).toBe(
			"ling:v1:DE:SURF;See;Standard;Lemma;Lexeme;NOUN;-;observed;See;Lexeme;NOUN;gender=Fem;-",
		);
	});

	it("serializes multi-valued and layered feature bags canonically", () => {
		const relativeDeterminer = {
			canonicalLemma: "welch",
			inherentFeatures: {
				pronType: ["Rel", "Int"],
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "❓",
			pos: "DET",
		} satisfies Lemma<"German", "Lexeme", "DET">;

		const possessiveSelection = {
			language: "German",
			orthographicStatus: "Standard",
			selectionCoverage: "Full",
			spelledSelection: "dessen",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "DET",
				},
				inflectionalFeatures: {
					gender: ["Neut", "Masc"],
					"gender[psor]": ["Neut"],
					"number[psor]": "Sing",
				},
				normalizedFullSurface: "dessen",
				surfaceKind: "Inflection",
				target: {
					canonicalLemma: "dessen",
				},
			},
		} satisfies LingIdSurfaceInput<"German">;

		expect(toGermanSurfaceLingId(relativeDeterminer)).toBe(
			"ling:v1:DE:SURF;welch;Standard;Lemma;Lexeme;DET;-;observed;welch;Lexeme;DET;pronType=~Int|Rel;❓",
		);
		expect(toGermanSurfaceLingId(possessiveSelection)).toBe(
			"ling:v1:DE:SURF;dessen;Standard;Inflection;Lexeme;DET;gender=~Masc|Neut,gender[psor]=~Neut,number[psor]=Sing;canon;dessen",
		);
	});

	it("serializes Hebrew lemmas and multi-valued verbal features with the HE header", () => {
		const katav = buildHebrewKatavLemma();

		const selection = {
			language: "Hebrew",
			orthographicStatus: "Standard",
			selectionCoverage: "Full",
			spelledSelection: "katvu",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "VERB",
				},
				inflectionalFeatures: {
					number: "Plur",
					person: ["1", "2", "3"],
					tense: "Past",
				},
				normalizedFullSurface: "katvu",
				surfaceKind: "Inflection",
				target: {
					canonicalLemma: "katav",
				},
			},
		} satisfies LingIdSurfaceInput<"Hebrew">;

		expect(toHebrewSurfaceLingId(katav)).toBe(
			"ling:v1:HE:SURF;katav;Standard;Lemma;Lexeme;VERB;-;observed;katav;Lexeme;VERB;hebBinyan=PAAL;✍️",
		);
		expect(toHebrewSurfaceLingId(selection)).toBe(
			"ling:v1:HE:SURF;katvu;Standard;Inflection;Lexeme;VERB;number=Plur,person=~1|2|3,tense=Past;canon;katav",
		);
	});
});
