import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../shared/english-common-enums";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-NUM.html
const EnglishNumeralExtPos = UniversalFeature.ExtPos.extract(["PROPN"]);

// https://universaldependencies.org/u/feat/NumForm.html
const EnglishNumeralNumForm = EnglishFeature.NumForm.extract([
	"Digit",
	"Roman",
	"Word",
]);

// https://universaldependencies.org/u/feat/NumType.html
const EnglishNumeralNumType = EnglishFeature.NumType.extract(["Card", "Frac"]);

const EnglishNumeralInflectionalFeaturesSchema = featureSchema({});

const EnglishNumeralInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishNumeralExtPos, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-NUM.html
	numForm: EnglishNumeralNumForm, // https://universaldependencies.org/u/feat/NumForm.html
	numType: EnglishNumeralNumType, // https://universaldependencies.org/u/feat/NumType.html
});

export const EnglishNumeralSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishNumeralInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishNumeralInherentFeaturesSchema,
	pos: "NUM",
});
