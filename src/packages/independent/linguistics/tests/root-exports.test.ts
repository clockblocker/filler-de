import { describe, expect, it } from "bun:test";
import * as linguistics from "../src";
import {
	type AnyLemma,
	type AnySelection,
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
	RelationTargetsSchema,
	Relations,
	SelectionSchema,
	SurfaceKind,
	TARGET_LANGUAGES,
	TargetLanguageSchema,
	toLingId,
	type UnknownSelection,
} from "../src";

describe("root exports", () => {
	it("exposes the curated native root surface", () => {
		expect(TARGET_LANGUAGES).toEqual(["German", "English"]);
		expect(TargetLanguageSchema.parse("German")).toBe("German");
		expect(TargetLanguageSchema.parse("English")).toBe("English");
		expect(OrthographicStatus.Standard).toBe("Standard");
		expect(SurfaceKind.Inflection).toBe("Inflection");
		expect(LemmaKind.Lexeme).toBe("Lexeme");
		expect(typeof toLingId).toBe("function");
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
	});

	it("supports ergonomic broad type aliases", () => {
		const lemma: AnyLemma<"German"> = {
			inherentFeatures: { gender: "Neut" } satisfies InherentFeatures,
			language: "German",
			lemmaKind: "Lexeme",
			pos: "NOUN",
			spelledLemma: "Kind",
		};
		const unknownSelection: AnySelection<"German"> = {
			language: "German",
			orthographicStatus: "Unknown",
		} satisfies UnknownSelection;

		expect(lemma.pos).toBe("NOUN");
		expect(unknownSelection.orthographicStatus).toBe("Unknown");
	});

	it("supports English in the broad type aliases", () => {
		const lemma: AnyLemma<"English"> = {
			inherentFeatures: { gender: "Neut" } satisfies InherentFeatures,
			language: "English",
			lemmaKind: "Lexeme",
			pos: "NOUN",
			spelledLemma: "dog",
		};
		const unknownSelection: AnySelection<"English"> = {
			language: "English",
			orthographicStatus: "Unknown",
		} satisfies UnknownSelection;

		expect(lemma.pos).toBe("NOUN");
		expect(unknownSelection.orthographicStatus).toBe("Unknown");
	});

	it("exposes a dedicated relations api", () => {
		expect(LexicalRelation.synonym).toBe("synonym");
		expect(MorphologicalRelation.derivedFrom).toBe("derivedFrom");
		expect(RelationTargetsSchema.safeParse(["laufen"]).success).toBe(true);
		expect(
			LexicalRelationsSchema.safeParse({
				synonym: ["laufen"],
			}).success,
		).toBe(true);
		expect(
			MorphologicalRelationsSchema.safeParse({
				derivedFrom: ["Gang"],
			}).success,
		).toBe(true);
		expect(Relations.Lexical.getInverse("hypernym")).toBe("hyponym");
		expect(Relations.Morphological.getRepr("derivedFrom")).toBe("<-");
	});

	it("hides internal schema helpers from the root surface", () => {
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
