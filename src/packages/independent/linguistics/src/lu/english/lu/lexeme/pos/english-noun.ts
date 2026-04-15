import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
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

export const EnglishNounSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishNounInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishNounInherentFeaturesSchema,
	pos: "NOUN",
});
