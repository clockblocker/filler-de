import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishSymbolExtPos } from "./english-symbol-enums";

const EnglishSymbolNumber = UniversalFeature.GrammaticalNumber.extract([
	"Plur",
	"Sing",
]);

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-SYM.html
// - https://universaldependencies.org/u/feat/ExtPos.html
export const EnglishSymbolInflectionalFeaturesSchema = featureSchema({
	number: EnglishSymbolNumber.optional(),
});

export const EnglishSymbolInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	extPos: EnglishSymbolExtPos.optional(),
});
