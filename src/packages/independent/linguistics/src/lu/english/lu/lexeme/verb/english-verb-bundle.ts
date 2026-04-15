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

export const EnglishVerbLemmaSchema = withLingIdLemmaDtoCompatibility(
	z.object({
		meaningInEmojis: MeaningInEmojisSchema,
		inherentFeatures: EnglishVerbInherentFeaturesSchema,
		lemmaKind: z.literal("Lexeme"),
		language: z.literal("English"),
		pos: z.literal("VERB"),
		canonicalLemma: z.string(),
	}),
) satisfies LemmaSchemaFor<"Lexeme", "VERB">;

export const EnglishVerbInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: EnglishVerbInflectionalFeaturesSchema,
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
}) satisfies SelectionSchemaFor<"Standard", "Inflection", "Lexeme", "VERB">;

export const EnglishVerbLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
}) satisfies SelectionSchemaFor<"Standard", "Lemma", "Lexeme", "VERB">;

export const EnglishVerbStandardVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Standard", "Variant", "Lexeme", "VERB">;

export const EnglishVerbTypoInflectionSelectionSchema = buildInflectionSelection(
	{
		inflectionalFeaturesSchema: EnglishVerbInflectionalFeaturesSchema,
		language: "English",
		lemmaSchema: EnglishVerbLemmaSchema,
		lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
		orthographicStatus: "Typo",
	},
) satisfies SelectionSchemaFor<"Typo", "Inflection", "Lexeme", "VERB">;

export const EnglishVerbTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Lemma", "Lexeme", "VERB">;

export const EnglishVerbTypoVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaSchema: EnglishVerbLemmaSchema,
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Typo", "Variant", "Lexeme", "VERB">;
