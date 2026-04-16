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

const GermanNounLemma = defineLemmaSchemaDescriptor({
	language: "German",
	schema: z
		.object({
			canonicalLemma: z.string(),
			inherentFeatures: GermanNounInherentFeaturesSchema,
			language: z.literal("German"),
			lemmaKind: z.literal("Lexeme"),
			meaningInEmojis: MeaningInEmojisSchema,
			pos: z.literal("NOUN"),
		})
		.strict(),
});

const GermanNounLemmaSchema = GermanNounLemma.schema satisfies LemmaSchemaFor<
	"Lexeme",
	"NOUN"
>;

const GermanNounInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanNounInflectionalFeaturesSchema,
	lemma: GermanNounLemma,
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
}) satisfies SelectionSchemaFor<"Standard", "Inflection", "Lexeme", "NOUN">;

const GermanNounLemmaSelectionSchema = buildLemmaSelection({
	lemma: GermanNounLemma,
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
}) satisfies SelectionSchemaFor<"Standard", "Lemma", "Lexeme", "NOUN">;

const GermanNounTypoInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: GermanNounInflectionalFeaturesSchema,
	lemma: GermanNounLemma,
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Inflection", "Lexeme", "NOUN">;

const GermanNounTypoLemmaSelectionSchema = buildLemmaSelection({
	lemma: GermanNounLemma,
	lemmaIdentityShape: GermanNounLemmaIdentityShape,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Lemma", "Lexeme", "NOUN">;

export const GermanNounSchemas = {
	InflectionSelectionSchema: GermanNounInflectionSelectionSchema,
	LemmaSchema: GermanNounLemmaSchema,
	LemmaSelectionSchema: GermanNounLemmaSelectionSchema,
	TypoInflectionSelectionSchema: GermanNounTypoInflectionSelectionSchema,
	TypoLemmaSelectionSchema: GermanNounTypoLemmaSelectionSchema,
};
