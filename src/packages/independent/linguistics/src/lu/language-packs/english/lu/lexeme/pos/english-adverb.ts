import { UniversalFeature } from "../../../../../universal/enums/feature";
import {
	featureSchema,
	featureValueSet,
} from "../../../../../universal/helpers/schema-targets";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import { EnglishFeature } from "../shared/english-common-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADV.html
const EnglishAdverbExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"ADV",
	"CCONJ",
	"SCONJ",
]);

// https://universaldependencies.org/u/feat/NumForm.html
const EnglishAdverbNumForm = EnglishFeature.NumForm.extract(["Word"]);

// https://universaldependencies.org/u/feat/NumType.html
const EnglishAdverbNumType = EnglishFeature.NumType.extract([
	"Frac",
	"Mult",
	"Ord",
]);

// https://universaldependencies.org/docs/en/feat/PronType.html
const EnglishAdverbPronType = EnglishFeature.PronType.extract([
	"Dem",
	"Ind",
	"Int",
	"Neg",
	"Rel",
	"Tot",
]);

// https://universaldependencies.org/u/feat/Style.html
const EnglishAdverbStyle = EnglishFeature.Style.extract(["Expr", "Slng"]);

const EnglishAdverbInflectionalFeaturesSchema = featureSchema({
	degree: EnglishFeature.Degree, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Degree.html
});

const EnglishAdverbInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishAdverbExtPos, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADV.html
	numForm: EnglishAdverbNumForm, // https://universaldependencies.org/u/feat/NumForm.html
	numType: EnglishAdverbNumType, // https://universaldependencies.org/u/feat/NumType.html
	pronType: featureValueSet(EnglishAdverbPronType), // https://universaldependencies.org/docs/en/feat/PronType.html
	style: EnglishAdverbStyle, // https://universaldependencies.org/u/feat/Style.html
});

export const EnglishAdverbSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAdverbInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAdverbInherentFeaturesSchema,
	pos: "ADV",
});
