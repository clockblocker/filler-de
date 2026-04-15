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
	GermanVerbInflectionalFeaturesSchema,
	GermanVerbInherentFeaturesSchema,
} from "./parts/german-verb-features";

const GermanVerbLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("VERB"),
} satisfies z.ZodRawShape;

export const GermanVerbIdentityFeatureKeys = ["separable"] as const;

const GermanVerbLemmaSchema = withLingIdLemmaDtoCompatibility(
	z.object({
		meaningInEmojis: MeaningInEmojisSchema,
		inherentFeatures: GermanVerbInherentFeaturesSchema,
		lemmaKind: z.literal("Lexeme"),
		language: z.literal("German"),
		pos: z.literal("VERB"),
		canonicalLemma: z.string(),
	}),
) satisfies LemmaSchemaFor<"Lexeme">;

const GermanVerbInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanVerbInflectionalFeaturesSchema,
	language: "German",
	lemmaSchema: GermanVerbLemmaSchema,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
}) satisfies SelectionSchemaFor<"Standard", "Inflection", "Lexeme">;

const GermanVerbLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaSchema: GermanVerbLemmaSchema,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
}) satisfies SelectionSchemaFor<"Standard", "Lemma", "Lexeme">;

const GermanVerbStandardVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaSchema: GermanVerbLemmaSchema,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Standard", "Variant", "Lexeme">;

const GermanVerbTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: GermanVerbInflectionalFeaturesSchema,
		language: "German",
		lemmaSchema: GermanVerbLemmaSchema,
		lemmaIdentityShape: GermanVerbLemmaIdentityShape,
		orthographicStatus: "Typo",
	},
) satisfies SelectionSchemaFor<"Typo", "Inflection", "Lexeme">;

const GermanVerbTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaSchema: GermanVerbLemmaSchema,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Lemma", "Lexeme">;

const GermanVerbTypoVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaSchema: GermanVerbLemmaSchema,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Typo", "Variant", "Lexeme">;

export const GermanVerbSchemas = {
	InflectionSelectionSchema: GermanVerbInflectionSelectionSchema,
	LemmaSelectionSchema: GermanVerbLemmaSelectionSchema,
	StandardVariantSelectionSchema: GermanVerbStandardVariantSelectionSchema,
	TypoInflectionSelectionSchema: GermanVerbTypoInflectionSelectionSchema,
	TypoLemmaSelectionSchema: GermanVerbTypoLemmaSelectionSchema,
	TypoVariantSelectionSchema: GermanVerbTypoVariantSelectionSchema,
	LemmaSchema: GermanVerbLemmaSchema,
};
