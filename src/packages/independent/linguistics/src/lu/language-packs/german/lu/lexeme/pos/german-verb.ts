import z from "zod/v3";
import { UniversalFeature } from "../../../../../universal/enums/feature";
import { buildInflectionSelection } from "../../../../../universal/factories/buildInflectionSelection";
import { buildLemmaSelection } from "../../../../../universal/factories/buildLemmaSelection";
import { defineLemmaSchemaDescriptor } from "../../../../../universal/factories/lemma-schema-descriptor";
import type {
	LemmaSchemaFor,
	SelectionSchemaFor,
} from "../../../../../universal/helpers/schema-targets";
import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { MeaningInEmojisSchema } from "../../../../../universal/meaning-in-emojis";
import { GermanVerbalInflectionalFeaturesSchema } from "../shared/german-verbal-inflection-features";

const GermanVerbInflectionalFeaturesSchema =
	GermanVerbalInflectionalFeaturesSchema;

const GermanVerbInherentFeaturesSchema = featureSchema({
	hasGovPrep: UniversalFeature.HasGovPrep,
	hasSepPrefix: UniversalFeature.HasSepPrefix,
	lexicallyReflexive: UniversalFeature.LexicallyReflexive,
	verbType: UniversalFeature.VerbType.extract(["Mod"]),
});

const GermanVerbLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("VERB"),
} satisfies z.ZodRawShape;

const GermanVerbLemma = defineLemmaSchemaDescriptor({
	language: "German",
	schema: z
		.object({
			canonicalLemma: z.string(),
			inherentFeatures: GermanVerbInherentFeaturesSchema,
			language: z.literal("German"),
			lemmaKind: z.literal("Lexeme"),
			meaningInEmojis: MeaningInEmojisSchema,
			pos: z.literal("VERB"),
		})
		.strict(),
});

const GermanVerbLemmaSchema =
	GermanVerbLemma.schema satisfies LemmaSchemaFor<"Lexeme">;

const GermanVerbInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanVerbInflectionalFeaturesSchema,
	lemma: GermanVerbLemma,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
}) satisfies SelectionSchemaFor<"Standard", "Inflection", "Lexeme">;

const GermanVerbLemmaSelectionSchema = buildLemmaSelection({
	lemma: GermanVerbLemma,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
}) satisfies SelectionSchemaFor<"Standard", "Lemma", "Lexeme">;

const GermanVerbStandardVariantSelectionSchema = buildLemmaSelection({
	lemma: GermanVerbLemma,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Standard", "Variant", "Lexeme">;

const GermanVerbTypoInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanVerbInflectionalFeaturesSchema,
	lemma: GermanVerbLemma,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Inflection", "Lexeme">;

const GermanVerbTypoLemmaSelectionSchema = buildLemmaSelection({
	lemma: GermanVerbLemma,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Lemma", "Lexeme">;

const GermanVerbTypoVariantSelectionSchema = buildLemmaSelection({
	lemma: GermanVerbLemma,
	lemmaIdentityShape: GermanVerbLemmaIdentityShape,
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
