import { UniversalFeature } from "../../../../../universal/enums/feature";
import {
	featureSchema,
	featureValueSet,
} from "../../../../../universal/helpers/schema-targets";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import { EnglishFeature } from "../shared/english-common-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-DET.html
const EnglishDeterminerExtPos = UniversalFeature.ExtPos.extract([
	"ADV",
	"PRON",
]);

// https://universaldependencies.org/u/feat/NumForm.html
const EnglishDeterminerNumForm = EnglishFeature.NumForm.extract(["Word"]);

// https://universaldependencies.org/u/feat/NumType.html
const EnglishDeterminerNumType = EnglishFeature.NumType.extract(["Frac"]);

// https://universaldependencies.org/docs/en/feat/PronType.html
const EnglishDeterminerPronType = EnglishFeature.PronType.extract([
	"Art",
	"Dem",
	"Ind",
	"Int",
	"Neg",
	"Rcp",
	"Rel",
	"Tot",
]);

// https://universaldependencies.org/u/feat/Style.html
const EnglishDeterminerStyle = EnglishFeature.Style.extract(["Vrnc"]);

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
const EnglishDeterminerNumber = EnglishFeature.Number.extract(["Plur", "Sing"]);

const EnglishDeterminerInflectionalFeaturesSchema = featureSchema({
	number: EnglishDeterminerNumber,
});

const EnglishDeterminerInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	definite: EnglishFeature.Definite, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Definite.html
	extPos: EnglishDeterminerExtPos, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-DET.html
	numForm: EnglishDeterminerNumForm, // https://universaldependencies.org/u/feat/NumForm.html
	numType: EnglishDeterminerNumType, // https://universaldependencies.org/u/feat/NumType.html
	pronType: featureValueSet(EnglishDeterminerPronType), // https://universaldependencies.org/docs/en/feat/PronType.html
	style: EnglishDeterminerStyle, // https://universaldependencies.org/u/feat/Style.html
});

export const EnglishDeterminerSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishDeterminerInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishDeterminerInherentFeaturesSchema,
	pos: "DET",
});
