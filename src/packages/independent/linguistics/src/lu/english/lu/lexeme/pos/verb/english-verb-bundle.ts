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
	EnglishVerbInflectionalFeaturesSchema,
	EnglishVerbInherentFeaturesSchema,
} from "./parts/english-verb-features";

const EnglishVerbLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("VERB"),
} satisfies z.ZodRawShape;

const EnglishVerbLemmaSchema = withLingIdLemmaDtoCompatibility(
	z.object({
		canonicalLemma: z.string(),
		inherentFeatures: EnglishVerbInherentFeaturesSchema,
		language: z.literal("English"),
		lemmaKind: z.literal("Lexeme"),
		meaningInEmojis: MeaningInEmojisSchema,
		pos: z.literal("VERB"),
	}),
) satisfies LemmaSchemaFor<"Lexeme", "VERB">;

const EnglishVerbInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: EnglishVerbInflectionalFeaturesSchema,
	language: "English",
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	lemmaSchema: EnglishVerbLemmaSchema,
}) satisfies SelectionSchemaFor<"Standard", "Inflection", "Lexeme", "VERB">;

const EnglishVerbLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	lemmaSchema: EnglishVerbLemmaSchema,
}) satisfies SelectionSchemaFor<"Standard", "Lemma", "Lexeme", "VERB">;

const EnglishVerbStandardVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	lemmaSchema: EnglishVerbLemmaSchema,
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Standard", "Variant", "Lexeme", "VERB">;

const EnglishVerbTypoInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: EnglishVerbInflectionalFeaturesSchema,
	language: "English",
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	lemmaSchema: EnglishVerbLemmaSchema,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Inflection", "Lexeme", "VERB">;

const EnglishVerbTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	lemmaSchema: EnglishVerbLemmaSchema,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Lemma", "Lexeme", "VERB">;

const EnglishVerbTypoVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaIdentityShape: EnglishVerbLemmaIdentityShape,
	lemmaSchema: EnglishVerbLemmaSchema,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Typo", "Variant", "Lexeme", "VERB">;

export const EnglishVerbSchemas = {
	InflectionSelectionSchema: EnglishVerbInflectionSelectionSchema,
	LemmaSchema: EnglishVerbLemmaSchema,
	LemmaSelectionSchema: EnglishVerbLemmaSelectionSchema,
	StandardVariantSelectionSchema: EnglishVerbStandardVariantSelectionSchema,
	TypoInflectionSelectionSchema: EnglishVerbTypoInflectionSelectionSchema,
	TypoLemmaSelectionSchema: EnglishVerbTypoLemmaSelectionSchema,
	TypoVariantSelectionSchema: EnglishVerbTypoVariantSelectionSchema,
};
