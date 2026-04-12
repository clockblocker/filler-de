import { describe, expect, it } from "bun:test";
import {
	Case,
	LemmaKind,
	LemmaSchema,
	MorphemeKind,
	OrthographicStatus,
	PhrasemeKind,
	Pos,
	SelectionSchema,
	SurfaceKind,
	TARGET_LANGUAGES,
	TargetLanguageSchema,
	type AnyLemma,
	type AnySelection,
	type InherentFeatures,
	type UnknownSelection,
} from "../src";

describe("root exports", () => {
	it("exposes the curated native root surface", () => {
		expect(TARGET_LANGUAGES).toEqual(["German"]);
		expect(TargetLanguageSchema.parse("German")).toBe("German");
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
	});

	it("supports ergonomic broad type aliases", () => {
		const lemma: AnyLemma<"German"> = {
			inherentFeatures: { gender: "Neut" } satisfies InherentFeatures,
			lexicalRelations: {},
			morphologicalRelations: {},
			pos: "NOUN",
		};
		const unknownSelection: AnySelection<"German"> = {
			orthographicStatus: "Unknown",
		} satisfies UnknownSelection;

		expect(lemma.pos).toBe("NOUN");
		expect(unknownSelection.orthographicStatus).toBe("Unknown");
	});
});
