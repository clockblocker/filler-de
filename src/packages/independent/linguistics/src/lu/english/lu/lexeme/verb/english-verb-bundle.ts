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
	EnglishVerbInflectionalFeaturesSchema,
	EnglishVerbInherentFeaturesSchema,
} from "./parts/english-verb-features";

const EnglishVerbLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("VERB"),
} satisfies z.ZodRawShape;

const EnglishVerbLemmaSchema = withLingIdLemmaDtoCompatibility(
	z.object({
		meaningInEmojis: MeaningInEmojisSchema,
		inherentFeatures: EnglishVerbInherentFeaturesSchema,
		lemmaKind: z.literal("Lexeme"),
		language: z.literal("English"),
		pos: z.literal("VERB"),
		canonicalLemma: z.string(),
	}),
) satisfies LemmaSchemaFor<"Lexeme", "VERB">;

const EnglishVerbInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: EnglishVerbInflectionalFeaturesSchema,
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
}) satisfies SelectionSchemaFor<"Standard", "Inflection", "Lexeme", "VERB">;

const EnglishVerbLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
}) satisfies SelectionSchemaFor<"Standard", "Lemma", "Lexeme", "VERB">;

const EnglishVerbStandardVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Standard", "Variant", "Lexeme", "VERB">;

const EnglishVerbTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: EnglishVerbInflectionalFeaturesSchema,
		language: "English",
		lemmaSchema: EnglishVerbLemmaSchema,
		lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
		orthographicStatus: "Typo",
	},
) satisfies SelectionSchemaFor<"Typo", "Inflection", "Lexeme", "VERB">;

const EnglishVerbTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Lemma", "Lexeme", "VERB">;

const EnglishVerbTypoVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Typo", "Variant", "Lexeme", "VERB">;

export const EnglishVerbSchemas = {
	InflectionSelectionSchema: EnglishVerbInflectionSelectionSchema,
	LemmaSelectionSchema: EnglishVerbLemmaSelectionSchema,
	StandardVariantSelectionSchema: EnglishVerbStandardVariantSelectionSchema,
	TypoInflectionSelectionSchema: EnglishVerbTypoInflectionSelectionSchema,
	TypoLemmaSelectionSchema: EnglishVerbTypoLemmaSelectionSchema,
	TypoVariantSelectionSchema: EnglishVerbTypoVariantSelectionSchema,
	LemmaSchema: EnglishVerbLemmaSchema,
};
