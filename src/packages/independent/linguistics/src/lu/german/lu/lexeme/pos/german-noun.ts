import z from "zod/v3";
import { UniversalFeature } from "../../../../universal/enums/feature";
import { buildInflectionSelection } from "../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../universal/factories/buildLemmaSelection";
import type {
	LemmaSchemaFor,
	SelectionSchemaFor,
} from "../../../../universal/helpers/schema-targets";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { withLingIdLemmaDtoCompatibility } from "../../../../universal/ling-id-schema-compat";
import { MeaningInEmojisSchema } from "../../../../universal/meaning-in-emojis";
import { GermanFeature } from "../shared/german-common-enums";

const GermanNounInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	number: GermanFeature.Number,
});

const GermanNounInherentFeaturesSchema = featureSchema({
	gender: GermanFeature.Gender,
	hyph: UniversalFeature.Hyph,
});

const GermanNounLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("NOUN"),
} satisfies z.ZodRawShape;

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
