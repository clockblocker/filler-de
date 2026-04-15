import z from "zod/v3";
import type {
	LemmaSchemaFor,
	SelectionSchemaFor,
} from "../../../../universal/helpers/schema-targets";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";
import { withLingIdLemmaDtoCompatibility } from "../../../../universal/ling-id-schema-compat";
import {
	EnglishNounInflectionalFeaturesSchema,
	EnglishNounInherentFeaturesSchema,
} from "./parts/english-noun-features";

const EnglishNounLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("NOUN"),
} satisfies z.ZodRawShape;

const EnglishNounLemmaSchema = withLingIdLemmaDtoCompatibility(
	z.object({
		meaningInEmojis: MeaningInEmojisSchema,
		inherentFeatures: EnglishNounInherentFeaturesSchema,
		lemmaKind: z.literal("Lexeme"),
		language: z.literal("English"),
		pos: z.literal("NOUN"),
		canonicalLemma: z.string(),
	}),
) satisfies LemmaSchemaFor<"Lexeme", "NOUN">;

const EnglishNounInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: EnglishNounInflectionalFeaturesSchema,
	language: "English",
	lemmaSchema: EnglishNounLemmaSchema,
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
}) satisfies SelectionSchemaFor<"Standard", "Inflection", "Lexeme", "NOUN">;

const EnglishNounLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishNounLemmaSchema,
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
}) satisfies SelectionSchemaFor<"Standard", "Lemma", "Lexeme", "NOUN">;

const EnglishNounStandardVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishNounLemmaSchema,
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Standard", "Variant", "Lexeme", "NOUN">;

const EnglishNounTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: EnglishNounInflectionalFeaturesSchema,
		language: "English",
		lemmaSchema: EnglishNounLemmaSchema,
		lemmaIdentityShape: EnglishNounLemmaIdentityShape,
		orthographicStatus: "Typo",
	},
) satisfies SelectionSchemaFor<"Typo", "Inflection", "Lexeme", "NOUN">;

const EnglishNounTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishNounLemmaSchema,
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Lemma", "Lexeme", "NOUN">;

const EnglishNounTypoVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishNounLemmaSchema,
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Typo", "Variant", "Lexeme", "NOUN">;

export const EnglishNounSchemas = {
	InflectionSelectionSchema: EnglishNounInflectionSelectionSchema,
	LemmaSelectionSchema: EnglishNounLemmaSelectionSchema,
	StandardVariantSelectionSchema: EnglishNounStandardVariantSelectionSchema,
	TypoInflectionSelectionSchema: EnglishNounTypoInflectionSelectionSchema,
	TypoLemmaSelectionSchema: EnglishNounTypoLemmaSelectionSchema,
	TypoVariantSelectionSchema: EnglishNounTypoVariantSelectionSchema,
	LemmaSchema: EnglishNounLemmaSchema,
};
