import { describe, expect, it } from "bun:test";
import * as linguistics from "../../src";
import {
	type AnyLemma,
	type AnySelection,
	type AnySurface,
	Case,
	type InherentFeatures,
	LemmaKind,
	LemmaSchema,
	LexicalRelation,
	LexicalRelationsSchema,
	MorphemeKind,
	MorphologicalRelation,
	MorphologicalRelationsSchema,
	OrthographicStatus,
	PhrasemeKind,
	Pos,
	Relations,
	RelationTargetLingIdsSchema,
	SelectionSchema,
	SurfaceKind,
	SurfaceSchema,
	TARGET_LANGUAGES,
	TargetLanguageSchema,
	type UnknownSelection,
} from "../../src";

describe("public API usage", () => {
	it("exposes the curated root API surface", () => {
		expect(TARGET_LANGUAGES).toEqual(["German", "English"]);
		expect(TargetLanguageSchema.parse("German")).toBe("German");
		expect(TargetLanguageSchema.parse("English")).toBe("English");
		expect(typeof linguistics.buildToLingIdFor).toBe("function");
		expect(typeof linguistics.buildToSurfaceLingIdFor).toBe("function");
		expect(typeof linguistics.buildToShallowSurfaceLingIdFor).toBe(
			"function",
		);
		expect(typeof linguistics.parseLingId).toBe("function");
		expect(OrthographicStatus.Standard).toBe("Standard");
		expect(SurfaceKind.Inflection).toBe("Inflection");
		expect(LemmaKind.Lexeme).toBe("Lexeme");
		expect(Pos.NOUN).toBe("NOUN");
		expect(PhrasemeKind.Aphorism).toBe("Aphorism");
		expect(MorphemeKind.Root).toBe("Root");
		expect(Case.Nom).toBe("Nom");
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
		expect(SurfaceSchema.English.Standard.Inflection.Lexeme.NOUN).toBe(
			SurfaceSchema.English.Standard.Inflection.Lexeme.NOUN,
		);
		expect("toLingId" in linguistics).toBe(false);
		expect("buildToLemmaLingIdFor" in linguistics).toBe(false);
		expect("LingIdSchema" in linguistics).toBe(false);
	});

	it("supports ergonomic broad type aliases for German consumers", () => {
		const lemma = {
			canonicalLemma: "Kind",
			inherentFeatures: { gender: "Neut" } satisfies InherentFeatures,
			language: "German",
			lemmaKind: "Lexeme",
			meaningInEmojis: "👶",
			pos: "NOUN",
		} satisfies AnyLemma<"German">;
		const unknownSelection: AnySelection<"German"> = {
			language: "German",
			orthographicStatus: "Unknown",
			spelledSelection: "unknown",
		} satisfies UnknownSelection;

		expect(lemma.pos).toBe("NOUN");
		expect(unknownSelection.orthographicStatus).toBe("Unknown");
	});

	it("supports English in the broad type aliases", () => {
		const lemma = {
			canonicalLemma: "dog",
			inherentFeatures: { gender: "Neut" } satisfies InherentFeatures,
			language: "English",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🐕",
			pos: "NOUN",
		} satisfies AnyLemma<"English">;
		const unknownSelection: AnySelection<"English"> = {
			language: "English",
			orthographicStatus: "Unknown",
			spelledSelection: "unknown",
		} satisfies UnknownSelection;

		expect(lemma.pos).toBe("NOUN");
		expect(unknownSelection.orthographicStatus).toBe("Unknown");
	});

	it("validates surfaces through the exported root schemas", () => {
		const surface: AnySurface<"English"> = {
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
				lemma: {
					canonicalLemma: "walk",
					inherentFeatures: {},
					language: "English",
					lemmaKind: "Lexeme",
					meaningInEmojis: "🚶",
					pos: "VERB",
				},
			},
		};

		expect(
			SurfaceSchema.English.Standard.Inflection.Lexeme.VERB.safeParse(
				surface,
			).success,
		).toBe(true);
	});

	it("validates selections where the spelled selection is narrower than the full surface", () => {
		const selection: AnySelection<"English"> = {
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
		};

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
		expect(Relations.targetLingIdsSchema.safeParse([dog]).success).toBe(
			true,
		);
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
