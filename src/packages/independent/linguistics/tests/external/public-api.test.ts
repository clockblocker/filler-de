import { describe, expect, it } from "bun:test";
import * as linguistics from "../../src";
import {
	type KnownSelection,
	LexicalRelationsSchema,
	type LingId,
	LingIdCodec,
	type LingIdValueFor,
	lingOperation,
	lingSchemaFor,
	MorphologicalRelationsSchema,
	type Relations,
	RelationTargetLingIdsSchema,
	type Selection,
} from "../../src";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
	? 1
	: 2
	? true
	: false;

type Assert<T extends true> = T;

type _knownSelectionExcludesUnknown = Assert<
	Equal<KnownSelection<"English">["orthographicStatus"], "Standard" | "Typo">
>;

type _selectionDecodeHelperStaysConcrete = Assert<
	Equal<LingIdValueFor<"Selection", "English">, KnownSelection<"English">>
>;

type _relationTargetsAreLemmaIds = Assert<
	Equal<Relations.TargetLingIds[number], LingId<"Lemma">>
>;

type _selectionStillIncludesUnknownOutsideLingIdApi = Assert<
	Equal<
		Extract<
			Selection<"English">,
			{ orthographicStatus: "Unknown" }
		>["orthographicStatus"],
		"Unknown"
	>
>;

describe("public API usage", () => {
	it("exposes the curated root API surface", () => {
		expect(typeof linguistics.LingIdCodec.forLanguage).toBe("function");
		expect(typeof linguistics.lingOperation.forLanguage).toBe("function");
		expect(linguistics.LingIdCodec).toBe(LingIdCodec);
		expect(linguistics.lingOperation).toBe(lingOperation);
		expect(linguistics.lingSchemaFor).toBe(lingSchemaFor);
		expect(linguistics.LingIdCodec.English).toBeDefined();
		expect(linguistics.LingIdCodec.German).toBeDefined();
		expect(linguistics.LingIdCodec.Hebrew).toBeDefined();
		expect("buildToLingConverters" in linguistics).toBe(false);
		expect("LingId" in linguistics).toBe(false);
		expect("ParsedShallowSurfaceDto" in linguistics).toBe(false);
		expect("parseLingId" in linguistics).toBe(false);
		expect("parseShallowSurfaceLingId" in linguistics).toBe(false);
		expect("LingConverters" in linguistics).toBe(false);
		expect("SelectionSchema" in linguistics).toBe(true);
		expect("LemmaSchema" in linguistics).toBe(true);
	});

	it("keeps schemas and relations available from the package root", () => {
		const lemmaId = LingIdCodec.English.makeLingIdFor({
			canonicalLemma: "walk",
			inherentFeatures: {},
			language: "English",
			lemmaKind: "Lexeme",
			meaningInEmojis: "🚶",
			pos: "VERB",
		});

		expect(
			lingSchemaFor.Selection.English.Standard.Inflection.Lexeme.VERB,
		).toBeDefined();
		expect(
			lingSchemaFor.ResolvedSurface.German.Standard.Lemma.Lexeme.NOUN,
		).toBeDefined();
		expect(
			RelationTargetLingIdsSchema.parse([lemmaId] as LingId<"Lemma">[]),
		).toEqual([lemmaId] as LingId<"Lemma">[]);
		expect(() =>
			RelationTargetLingIdsSchema.parse([
				"ling:v2:EN:SURF-RES;walk;Inflection;Lexeme;VERB;tense=Pres,verbForm=Fin;walk;Lexeme;VERB;-;%F0%9F%9A%B6",
			]),
		).toThrow();
		expect(LexicalRelationsSchema.parse({ synonym: [] })).toEqual({
			synonym: [],
		});
		expect(MorphologicalRelationsSchema.parse({ derivedFrom: [] })).toEqual(
			{
				derivedFrom: [],
			},
		);
	});
});
