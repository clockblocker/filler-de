import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../shared/english-common-enums";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADJ.html
const EnglishAdjectiveExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"ADV",
	"SCONJ",
]);

// https://universaldependencies.org/u/feat/NumForm.html
const EnglishAdjectiveNumForm = EnglishFeature.NumForm.extract([
	"Combi",
	"Word",
]);

// https://universaldependencies.org/u/feat/NumType.html
const EnglishAdjectiveNumType = EnglishFeature.NumType.extract(["Frac", "Ord"]);

// https://universaldependencies.org/u/feat/Style.html
const EnglishAdjectiveStyle = EnglishFeature.Style.extract(["Expr"]);

const EnglishAdjectiveInflectionalFeaturesSchema = featureSchema({
	degree: EnglishFeature.Degree, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Degree.html
});

const EnglishAdjectiveInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishAdjectiveExtPos, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADJ.html
	numForm: EnglishAdjectiveNumForm, // https://universaldependencies.org/u/feat/NumForm.html
	numType: EnglishAdjectiveNumType, // https://universaldependencies.org/u/feat/NumType.html
	style: EnglishAdjectiveStyle, // https://universaldependencies.org/u/feat/Style.html
});

export const EnglishAdjectiveSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAdjectiveInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAdjectiveInherentFeaturesSchema,
	pos: "ADJ",
});
