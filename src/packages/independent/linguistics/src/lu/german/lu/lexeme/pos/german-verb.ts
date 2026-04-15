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
import { GermanVerbalInflectionalFeaturesSchema } from "../shared/german-verbal-inflection-features";

const GermanVerbInflectionalFeaturesSchema =
	GermanVerbalInflectionalFeaturesSchema;

const GermanVerbInherentFeaturesSchema = featureSchema({
	governedPreposition: UniversalFeature.GovernedPreposition,
	lexicallyReflexive: UniversalFeature.LexicallyReflexive,
	separable: UniversalFeature.Separable,
	verbType: UniversalFeature.VerbType.extract(["Mod"]),
});

const GermanVerbLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("VERB"),
} satisfies z.ZodRawShape;

const GermanVerbLemmaSchema = withLingIdLemmaDtoCompatibility(
	z.object({
		canonicalLemma: z.string(),
		inherentFeatures: GermanVerbInherentFeaturesSchema,
		language: z.literal("German"),
		lemmaKind: z.literal("Lexeme"),
		meaningInEmojis: MeaningInEmojisSchema,
		pos: z.literal("VERB"),
	}),
) satisfies LemmaSchemaFor<"Lexeme">;

const GermanVerbInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanVerbInflectionalFeaturesSchema,
	language: "German",
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	lemmaSchema: GermanVerbLemmaSchema,
}) satisfies SelectionSchemaFor<"Standard", "Inflection", "Lexeme">;

const GermanVerbLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	lemmaSchema: GermanVerbLemmaSchema,
}) satisfies SelectionSchemaFor<"Standard", "Lemma", "Lexeme">;

const GermanVerbStandardVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	lemmaSchema: GermanVerbLemmaSchema,
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Standard", "Variant", "Lexeme">;

const GermanVerbTypoInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanVerbInflectionalFeaturesSchema,
	language: "German",
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	lemmaSchema: GermanVerbLemmaSchema,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Inflection", "Lexeme">;

const GermanVerbTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	lemmaSchema: GermanVerbLemmaSchema,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Lemma", "Lexeme">;

const GermanVerbTypoVariantSelectionSchema = buildLemmaSelection({
	language: "German",
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	lemmaSchema: GermanVerbLemmaSchema,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Typo", "Variant", "Lexeme">;

export const GermanVerbSchemas = {
	InflectionSelectionSchema: GermanVerbInflectionSelectionSchema,
	LemmaSchema: GermanVerbLemmaSchema,
	LemmaSelectionSchema: GermanVerbLemmaSelectionSchema,
	StandardVariantSelectionSchema: GermanVerbStandardVariantSelectionSchema,
	TypoInflectionSelectionSchema: GermanVerbTypoInflectionSelectionSchema,
	TypoLemmaSelectionSchema: GermanVerbTypoLemmaSelectionSchema,
	TypoVariantSelectionSchema: GermanVerbTypoVariantSelectionSchema,
};
