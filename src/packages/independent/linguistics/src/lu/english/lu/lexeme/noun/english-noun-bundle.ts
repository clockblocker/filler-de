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

export const EnglishNounLemmaSchema = withLingIdLemmaDtoCompatibility(
	z.object({
		meaningInEmojis: MeaningInEmojisSchema,
		inherentFeatures: EnglishNounInherentFeaturesSchema,
		lemmaKind: z.literal("Lexeme"),
		language: z.literal("English"),
		pos: z.literal("NOUN"),
		canonicalLemma: z.string(),
	}),
) satisfies LemmaSchemaFor<"Lexeme", "NOUN">;

export const EnglishNounInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: EnglishNounInflectionalFeaturesSchema,
	language: "English",
	lemmaSchema: EnglishNounLemmaSchema,
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
}) satisfies SelectionSchemaFor<"Standard", "Inflection", "Lexeme", "NOUN">;

export const EnglishNounLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishNounLemmaSchema,
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
}) satisfies SelectionSchemaFor<"Standard", "Lemma", "Lexeme", "NOUN">;

export const EnglishNounStandardVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishNounLemmaSchema,
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Standard", "Variant", "Lexeme", "NOUN">;

export const EnglishNounTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: EnglishNounInflectionalFeaturesSchema,
		language: "English",
		lemmaSchema: EnglishNounLemmaSchema,
		lemmaIdentityShape: EnglishNounLemmaIdentityShape,
		orthographicStatus: "Typo",
	},
) satisfies SelectionSchemaFor<"Typo", "Inflection", "Lexeme", "NOUN">;

export const EnglishNounTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishNounLemmaSchema,
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Lemma", "Lexeme", "NOUN">;

export const EnglishNounTypoVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishNounLemmaSchema,
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Typo", "Variant", "Lexeme", "NOUN">;
