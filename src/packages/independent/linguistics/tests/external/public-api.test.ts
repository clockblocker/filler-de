import { describe, expect, it } from "bun:test";
import * as linguistics from "../../src";
import {
	type Lemma,
	LemmaSchema,
	LexicalRelation,
	LexicalRelationsSchema,
	LingId,
	MorphologicalRelation,
	MorphologicalRelationsSchema,
	Relations,
	RelationTargetLingIdsSchema,
	type ResolvedSurface,
	ResolvedSurfaceSchema,
	type Selection,
	SelectionSchema,
	type Surface,
	SurfaceSchema,
} from "../../src";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <
	T,
>() => T extends B ? 1 : 2
	? true
	: false;

type IsAny<T> = 0 extends 1 & T ? true : false;

type Assert<T extends true> = T;

type _selectionLanguageStaysNarrow = Assert<
	Equal<
		Selection<
			"English",
			"Standard",
			"Inflection",
			"Lexeme",
			"ADJ"
		>["language"],
		"English"
	>
>;

type _resolvedSurfaceDoesNotCollapseToAny = Assert<
	Equal<
		IsAny<
			ResolvedSurface<
				"English",
				"Standard",
				"Inflection",
				"Lexeme",
				"ADJ"
			>
		>,
		false
	>
>;

describe("public API usage", () => {
	it("exposes the curated root API surface", () => {
		expect(typeof linguistics.buildToLingConverters).toBe("function");
		expect(typeof linguistics.LingId.forLanguage).toBe("function");

		const germanLingConverters =
			linguistics.buildToLingConverters("German");
		expect(typeof germanLingConverters.getSurfaceLingId).toBe("function");
		expect(typeof germanLingConverters.getShallowSurfaceLingId).toBe(
			"function",
		);
		expect(typeof germanLingConverters.parseSurface).toBe("function");
		expect(typeof germanLingConverters.parseShallowSurface).toBe(
			"function",
		);
		expect(SelectionSchema.German.Standard.Inflection.Lexeme.NOUN).toBe(
			SelectionSchema.German.Standard.Inflection.Lexeme.NOUN,
		);
		expect(LemmaSchema.German.Lexeme.NOUN).toBe(
			LemmaSchema.German.Lexeme.NOUN,
		);
		expect(SelectionSchema.English.Standard.Inflection.Lexeme.NOUN).toBe(
			SelectionSchema.English.Standard.Inflection.Lexeme.NOUN,
		);
		expect(LemmaSchema.English.Lexeme.NOUN).toBe(
			LemmaSchema.English.Lexeme.NOUN,
		);
		expect(SelectionSchema.Hebrew.Standard.Inflection.Lexeme.VERB).toBe(
			SelectionSchema.Hebrew.Standard.Inflection.Lexeme.VERB,
		);
		expect(LemmaSchema.Hebrew.Lexeme.VERB).toBe(
			LemmaSchema.Hebrew.Lexeme.VERB,
		);
		expect(
			ResolvedSurfaceSchema.English.Standard.Inflection.Lexeme.VERB,
		).toBe(ResolvedSurfaceSchema.English.Standard.Inflection.Lexeme.VERB);
		expect(SurfaceSchema.English.Standard.Inflection.Lexeme.NOUN).toBe(
			SurfaceSchema.English.Standard.Inflection.Lexeme.NOUN,
		);
		expect("buildToLingIdFor" in linguistics).toBe(false);
		expect("buildToSurfaceLingIdFor" in linguistics).toBe(false);
		expect("buildToShallowSurfaceLingIdFor" in linguistics).toBe(false);
		expect("parseLingId" in linguistics).toBe(false);
		expect("toLingId" in linguistics).toBe(false);
		expect("buildToLemmaLingIdFor" in linguistics).toBe(false);
		expect("LingIdSchema" in linguistics).toBe(false);
		expect("TARGET_LANGUAGES" in linguistics).toBe(false);
		expect("TargetLanguageSchema" in linguistics).toBe(false);
		expect("OrthographicStatus" in linguistics).toBe(false);
		expect("SurfaceKind" in linguistics).toBe(false);
		expect("LemmaKind" in linguistics).toBe(false);
		expect("Case" in linguistics).toBe(false);
		expect("Gender" in linguistics).toBe(false);
		expect("GrammaticalNumber" in linguistics).toBe(false);
		expect("MorphemeKind" in linguistics).toBe(false);
		expect("PhrasemeKind" in linguistics).toBe(false);
		expect("Pos" in linguistics).toBe(false);
	});

	it("supports LingId and Relations namespace-style type access", () => {
		const germanLingConverters: LingId.Converters<"German"> =
			LingId.forLanguage("German");

		const lemma = {
			canonicalLemma: "See",
			inherentFeatures: {
				gender: "Fem",
			},
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🌊",
			pos: "NOUN",
		} satisfies Lemma<"German", "Lexeme", "NOUN">;

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
		} satisfies LingId.Input<"German">;

		const resolvedId: LingId.Value =
			germanLingConverters.getSurfaceLingId(lemma);

		const shallowId: LingId.ShallowId =
			germanLingConverters.getShallowSurfaceLingId(surface);

		const lexicalRelation = "synonym" satisfies Relations.LexicalRelation;

		const lexicalRelations = {
			synonym: [resolvedId],
		} satisfies Relations.LexicalRelations;

		const targetLingIds = [resolvedId] satisfies Relations.TargetLingIds;

		expect("target" in germanLingConverters.parseSurface(resolvedId)).toBe(
			true,
		);
		expect(shallowId.startsWith("ling:v1:DE:SURF-SHALLOW;")).toBe(true);
		expect(lexicalRelation).toBe("synonym");
		expect(lexicalRelations.synonym).toEqual(targetLingIds);
	});

	it("supports ergonomic broad type aliases for German consumers", () => {
		const lemma = {
			canonicalLemma: "Kind",
			inherentFeatures: { gender: "Neut" },
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "👶",
			pos: "NOUN",
		} satisfies Lemma<"German">;

		const unknownSelection = {
			language: "German",
			orthographicStatus: "Unknown",
			spelledSelection: "unknown",
		} satisfies Selection<"German">;

		expect(lemma.pos).toBe("NOUN");
		expect(unknownSelection.orthographicStatus).toBe("Unknown");
	});

	it("supports English in the broad type aliases", () => {
		const lemma = {
			canonicalLemma: "dog",
			inherentFeatures: { numType: "Card" },
			language: "English",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🐕",
			pos: "NOUN",
		} satisfies Lemma<"English">;

		const unknownSelection = {
			language: "English",
			orthographicStatus: "Unknown",
			spelledSelection: "unknown",
		} satisfies Selection<"English">;

		expect(lemma.pos).toBe("NOUN");
		expect(unknownSelection.orthographicStatus).toBe("Unknown");
	});

	it("supports Hebrew in the broad type aliases", () => {
		const lemma = {
			canonicalLemma: "katav",
			inherentFeatures: { hebBinyan: "PAAL" },
			language: "Hebrew",
			lemmaKind: "Lexeme",
			meaningInEmojis: "✍️",
			pos: "VERB",
		} satisfies Lemma<"Hebrew">;

		const unknownSelection = {
			language: "Hebrew",
			orthographicStatus: "Unknown",
			spelledSelection: "unknown",
		} satisfies Selection<"Hebrew">;

		expect(lemma.pos).toBe("VERB");
		expect(unknownSelection.orthographicStatus).toBe("Unknown");
		expect("PART" in SelectionSchema.Hebrew.Standard.Inflection.Lexeme).toBe(
			false,
		);
	});

	it("keeps narrow public aliases for concrete English adjective types", () => {
		const lemma = {
			canonicalLemma: "small",
			inherentFeatures: {
				abbr: "Yes",
				numType: "Ord",
			},
			language: "English",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🤏",
			pos: "ADJ",
		} satisfies Lemma<"English", "Lexeme", "ADJ">;

		const selection = {
			language: "English",
			orthographicStatus: "Standard",
			spelledSelection: "smaller",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "ADJ",
				},
				inflectionalFeatures: {
					degree: "Cmp",
				},
				normalizedFullSurface: "smaller",
				surfaceKind: "Inflection",
				target: {
					canonicalLemma: "small",
				},
			},
		} satisfies Selection<
			"English",
			"Standard",
			"Inflection",
			"Lexeme",
			"ADJ"
		>;

		expect(lemma.pos).toBe("ADJ");
		expect(selection.surface.discriminators.lemmaSubKind).toBe("ADJ");

		const _invalidLemma = {
			canonicalLemma: "small",
			inherentFeatures: {
				// @ts-expect-error English adjective lemmas should not expose unrelated inherent features
				gender: "Fem",
			},
			language: "English",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🤏",
			pos: "ADJ",
		} satisfies Lemma<"English", "Lexeme", "ADJ">;

		const _invalidSelection = {
			language: "English",
			orthographicStatus: "Standard",
			spelledSelection: "small",
			surface: {
				discriminators: {
					lemmaKind: "Lexeme",
					lemmaSubKind: "ADJ",
				},
				inflectionalFeatures: {
					// @ts-expect-error English adjective inflections should not expose unrelated features
					case: "Dat",
				},
				normalizedFullSurface: "small",
				surfaceKind: "Inflection",
				target: {
					canonicalLemma: "small",
				},
			},
		} satisfies Selection<
			"English",
			"Standard",
			"Inflection",
			"Lexeme",
			"ADJ"
		>;
	});

	it("validates surfaces through the exported root schemas", () => {
		const surface = {
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
				inherentFeatures: {},
				language: "English",
				lemmaKind: "Lexeme",
				meaningInEmojis: "🚶",
				pos: "VERB",
			},
		} satisfies Surface<"English">;

		expect(
			SurfaceSchema.English.Standard.Inflection.Lexeme.VERB.safeParse(
				surface,
			).success,
		).toBe(true);
	});

	it("validates selections where the spelled selection is narrower than the full surface", () => {
		const selection = {
			language: "English",
			orthographicStatus: "Standard",
			spelledSelection: "walk",
			surface: {
				discriminators: {
					lemmaKind: "Phraseme",
					lemmaSubKind: "Cliché",
				},
				normalizedFullSurface: "a walk in the park",
				surfaceKind: "Lemma",
				target: {
					canonicalLemma: "a walk in the park",
				},
			},
		} satisfies Selection<"English">;

		if (!("surface" in selection)) {
			throw new Error("expected known selection");
		}

		expect(selection.surface.discriminators.lemmaKind).toBe("Phraseme");
		expect(
			SelectionSchema.English.Standard.Lemma.Phraseme.Cliché.safeParse(
				selection,
			).success,
		).toBe(true);
	});

	it("validates resolved surfaces through the exported resolved-surface schemas", () => {
		const resolvedSurface = {
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
		} satisfies ResolvedSurface<"German", "Standard", "Lemma", "Lexeme", "NOUN">;

		const _invalidResolvedSurface = {
			discriminators: {
				lemmaKind: "Lexeme",
				lemmaSubKind: "NOUN",
			},
			normalizedFullSurface: "See",
			surfaceKind: "Lemma",
			// @ts-expect-error resolved surfaces require a hydrated lemma target
			target: {
				canonicalLemma: "See",
			},
		} satisfies ResolvedSurface<
			"German",
			"Standard",
			"Lemma",
			"Lexeme",
			"NOUN"
		>;

		expect(
			ResolvedSurfaceSchema.German.Standard.Lemma.Lexeme.NOUN.safeParse(
				resolvedSurface,
			).success,
		).toBe(true);
	});

	it("exposes a dedicated relations API", () => {
		const dog = "rel:dog";

		const cat = "rel:cat";

		expect(LexicalRelation.synonym).toBe("synonym");
		expect(MorphologicalRelation.derivedFrom).toBe("derivedFrom");
		expect(RelationTargetLingIdsSchema.safeParse([dog]).success).toBe(true);
		expect(RelationTargetLingIdsSchema.safeParse([]).success).toBe(true);
		expect(RelationTargetLingIdsSchema.safeParse([dog, dog]).success).toBe(
			true,
		);
		expect(RelationTargetLingIdsSchema.safeParse([12]).success).toBe(false);
		expect(
			LexicalRelationsSchema.safeParse({
				synonym: [dog],
			}).success,
		).toBe(true);
		expect(
			MorphologicalRelationsSchema.safeParse({
				derivedFrom: [cat],
			}).success,
		).toBe(true);
		expect(Relations.Lexical.getInverse("hypernym")).toBe("hyponym");
		expect(Relations.Morphological.getRepr("derivedFrom")).toBe("<-");
		expect("targetLingIdsSchema" in Relations).toBe(false);
	});

	it("keeps internal schema helpers off the root export surface", () => {
		expect("AbstractLexicalRelationsSchema" in linguistics).toBeFalse();
		expect("CaseSchema" in linguistics).toBeFalse();
		expect("GenderSchema" in linguistics).toBeFalse();
		expect("GermanInherentFeaturesSchemaByPos" in linguistics).toBeFalse();
		expect("GrammaticalNumberSchema" in linguistics).toBeFalse();
		expect("MorphemeKindSchema" in linguistics).toBeFalse();
		expect("NativeDiscriminatorSchema" in linguistics).toBeFalse();
		expect("PosSchema" in linguistics).toBeFalse();
		expect("PhrasemeKindSchema" in linguistics).toBeFalse();
	});
});
