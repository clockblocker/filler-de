import z from "zod/v3";
import { buildInflectionSelection } from "../../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../../universal/factories/buildLemmaSelection";
import type {
	LemmaSchemaFor,
	SelectionSchemaFor,
} from "../../../../../universal/helpers/schema-targets";
import { withLingIdLemmaDtoCompatibility } from "../../../../../universal/ling-id-schema-compat";
import { MeaningInEmojisSchema } from "../../../../../universal/meaning-in-emojis";
import {
	GermanNounInflectionalFeaturesSchema,
	GermanNounInherentFeaturesSchema,
} from "./parts/german-noun-features";

const GermanNounLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("NOUN"),
} satisfies z.ZodRawShape;

export const GermanNounIdentityFeatureKeys = ["gender"] as const;

const GermanNounLemmaSchema = withLingIdLemmaDtoCompatibility(
	z.object({
		canonicalLemma: z.string(),
		inherentFeatures: GermanNounInherentFeaturesSchema,
		language: z.literal("German"),
		lemmaKind: z.literal("Lexeme"),
		meaningInEmojis: MeaningInEmojisSchema,
		pos: z.literal("NOUN"),
	}),
) satisfies LemmaSchemaFor<"Lexeme", "NOUN">;

const GermanNounInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanNounInflectionalFeaturesSchema,
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
}) satisfies SelectionSchemaFor<"Standard", "Inflection", "Lexeme", "NOUN">;

const GermanNounLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
}) satisfies SelectionSchemaFor<"Standard", "Lemma", "Lexeme", "NOUN">;

const GermanNounStandardVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Standard", "Variant", "Lexeme", "NOUN">;

const GermanNounTypoInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanNounInflectionalFeaturesSchema,
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Inflection", "Lexeme", "NOUN">;

const GermanNounTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Lemma", "Lexeme", "NOUN">;

const GermanNounTypoVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Typo", "Variant", "Lexeme", "NOUN">;

export const GermanNounSchemas = {
	InflectionSelectionSchema: GermanNounInflectionSelectionSchema,
	LemmaSchema: GermanNounLemmaSchema,
	LemmaSelectionSchema: GermanNounLemmaSelectionSchema,
	StandardVariantSelectionSchema: GermanNounStandardVariantSelectionSchema,
	TypoInflectionSelectionSchema: GermanNounTypoInflectionSelectionSchema,
	TypoLemmaSelectionSchema: GermanNounTypoLemmaSelectionSchema,
	TypoVariantSelectionSchema: GermanNounTypoVariantSelectionSchema,
};
