import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";

const EnglishNounExtPos = UniversalFeature.ExtPos.extract(["ADV", "PROPN"]);
const EnglishNounNumForm = EnglishFeature.NumForm.extract([
	"Combi",
	"Digit",
	"Word",
]);
const EnglishNounNumType = UniversalFeature.NumType.extract([
	"Card",
	"Frac",
	"Ord",
]);
const EnglishNounStyle = EnglishFeature.Style.extract(["Expr", "Vrnc"]);

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-NOUN.html
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
// - https://universaldependencies.org/u/feat/NumForm.html
// - https://universaldependencies.org/u/feat/Style.html
export const EnglishNounInflectionalFeaturesSchema = featureSchema({
	number: EnglishFeature.Number,
});

export const EnglishNounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishNounExtPos,
	foreign: UniversalFeature.Foreign,
	numForm: EnglishNounNumForm,
	numType: EnglishNounNumType,
	style: EnglishNounStyle,
});
