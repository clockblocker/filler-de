import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import { EnglishSymbolExtPos } from "./english-symbol-enums";

const EnglishSymbolNumber = EnglishFeature.Number.extract(["Plur", "Sing"]);

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-SYM.html
// - https://universaldependencies.org/u/feat/ExtPos.html
export const EnglishSymbolInflectionalFeaturesSchema = featureSchema({
	number: EnglishSymbolNumber,
});

export const EnglishSymbolInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishSymbolExtPos,
});
