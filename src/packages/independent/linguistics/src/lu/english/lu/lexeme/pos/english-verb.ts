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
import { EnglishFeature } from "../shared/english-common-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-VERB.html
const EnglishVerbExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"CCONJ",
	"PROPN",
]);

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
const EnglishVerbNumber = EnglishFeature.Number.extract(["Plur", "Sing"]);

// https://universaldependencies.org/u/feat/Style.html
const EnglishVerbStyle = EnglishFeature.Style.extract(["Expr", "Vrnc"]);
const EnglishVerbVerbForm = EnglishFeature.VerbForm;

const EnglishVerbInflectionalFeaturesSchema = featureSchema({
	mood: EnglishFeature.Mood, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Mood.html
	number: EnglishVerbNumber,
	person: EnglishFeature.Person, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Person.html
	tense: EnglishFeature.Tense, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Tense.html
	verbForm: EnglishVerbVerbForm, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-VerbForm.html
	voice: UniversalFeature.Voice.extract(["Pass"]), // https://universaldependencies.org/en/feat/Voice.html
});

const EnglishVerbInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishVerbExtPos,
	governedPreposition: UniversalFeature.GovernedPreposition,
	phrasal: UniversalFeature.Phrasal,
	style: EnglishVerbStyle,
});

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
