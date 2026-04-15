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
	GermanNounInflectionalFeaturesSchema,
	GermanNounInherentFeaturesSchema,
} from "./parts/german-noun-features";

const GermanNounLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("NOUN"),
} satisfies z.ZodRawShape;

export const GermanNounIdentityFeatureKeys = ["gender"] as const;

export const GermanNounLemmaSchema = withLingIdLemmaDtoCompatibility(
	z.object({
		inherentFeatures: GermanNounInherentFeaturesSchema,
		language: z.literal("German"),
		lemmaKind: z.literal("Lexeme"),
		meaningInEmojis: MeaningInEmojisSchema,
		pos: z.literal("NOUN"),
		canonicalLemma: z.string(),
	}),
) satisfies LemmaSchemaFor<"Lexeme", "NOUN">;

export const GermanNounInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanNounInflectionalFeaturesSchema,
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
}) satisfies SelectionSchemaFor<"Standard", "Inflection", "Lexeme", "NOUN">;

export const GermanNounLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
}) satisfies SelectionSchemaFor<"Standard", "Lemma", "Lexeme", "NOUN">;

export const GermanNounStandardVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Standard", "Variant", "Lexeme", "NOUN">;

export const GermanNounTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: GermanNounInflectionalFeaturesSchema,
		language: "German",
		lemmaIdentityShape: GermanNounLemmaIdentityShape,
		lemmaSchema: GermanNounLemmaSchema,
		orthographicStatus: "Typo",
	},
) satisfies SelectionSchemaFor<"Typo", "Inflection", "Lexeme", "NOUN">;

export const GermanNounTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Lemma", "Lexeme", "NOUN">;

export const GermanNounTypoVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	lemmaSchema: GermanNounLemmaSchema,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Typo", "Variant", "Lexeme", "NOUN">;
