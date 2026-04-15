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

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-NOUN.html
const EnglishNounExtPos = UniversalFeature.ExtPos.extract(["ADV", "PROPN"]);
// https://universaldependencies.org/u/feat/NumForm.html
const EnglishNounNumForm = EnglishFeature.NumForm.extract([
	"Combi",
	"Digit",
	"Word",
]);
// https://universaldependencies.org/u/feat/NumType.html
const EnglishNounNumType = EnglishFeature.NumType.extract([
	"Card",
	"Frac",
	"Ord",
]);
// https://universaldependencies.org/u/feat/Style.html
const EnglishNounStyle = EnglishFeature.Style.extract(["Expr", "Vrnc"]);

const EnglishNounInflectionalFeaturesSchema = featureSchema({
	number: EnglishFeature.Number, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
});

const EnglishNounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishNounExtPos,
	foreign: UniversalFeature.Foreign,
	numForm: EnglishNounNumForm,
	numType: EnglishNounNumType,
	style: EnglishNounStyle,
});

const EnglishNounLemmaIdentityShape = {
	lemmaKind: z.literal("Lexeme"),
	pos: z.literal("NOUN"),
} satisfies z.ZodRawShape;

const EnglishNounLemmaSchema = withLingIdLemmaDtoCompatibility(
	z.object({
		canonicalLemma: z.string(),
		inherentFeatures: EnglishNounInherentFeaturesSchema,
		language: z.literal("English"),
		lemmaKind: z.literal("Lexeme"),
		meaningInEmojis: MeaningInEmojisSchema,
		pos: z.literal("NOUN"),
	}),
) satisfies LemmaSchemaFor<"Lexeme", "NOUN">;

const EnglishNounInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: EnglishNounInflectionalFeaturesSchema,
	language: "English",
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	lemmaSchema: EnglishNounLemmaSchema,
}) satisfies SelectionSchemaFor<"Standard", "Inflection", "Lexeme", "NOUN">;

const EnglishNounLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	lemmaSchema: EnglishNounLemmaSchema,
}) satisfies SelectionSchemaFor<"Standard", "Lemma", "Lexeme", "NOUN">;

const EnglishNounStandardVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	lemmaSchema: EnglishNounLemmaSchema,
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Standard", "Variant", "Lexeme", "NOUN">;

const EnglishNounTypoInflectionSelectionSchema = buildInflectionSelection({
	inflectionalFeaturesSchema: EnglishNounInflectionalFeaturesSchema,
	language: "English",
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	lemmaSchema: EnglishNounLemmaSchema,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Inflection", "Lexeme", "NOUN">;

const EnglishNounTypoLemmaSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	lemmaSchema: EnglishNounLemmaSchema,
	orthographicStatus: "Typo",
}) satisfies SelectionSchemaFor<"Typo", "Lemma", "Lexeme", "NOUN">;

const EnglishNounTypoVariantSelectionSchema = buildLemmaSelection({
	language: "English",
	lemmaIdentityShape: EnglishNounLemmaIdentityShape,
	lemmaSchema: EnglishNounLemmaSchema,
	orthographicStatus: "Typo",
	surfaceKind: "Variant",
}) satisfies SelectionSchemaFor<"Typo", "Variant", "Lexeme", "NOUN">;

export const EnglishNounSchemas = {
	InflectionSelectionSchema: EnglishNounInflectionSelectionSchema,
	LemmaSchema: EnglishNounLemmaSchema,
	LemmaSelectionSchema: EnglishNounLemmaSelectionSchema,
	StandardVariantSelectionSchema: EnglishNounStandardVariantSelectionSchema,
	TypoInflectionSelectionSchema: EnglishNounTypoInflectionSelectionSchema,
	TypoLemmaSelectionSchema: EnglishNounTypoLemmaSelectionSchema,
	TypoVariantSelectionSchema: EnglishNounTypoVariantSelectionSchema,
};
