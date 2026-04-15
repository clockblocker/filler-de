import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import { EnglishSymbolExtPos } from "./english-symbol-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
const EnglishSymbolNumber = EnglishFeature.Number.extract(["Plur", "Sing"]);

export const EnglishSymbolInflectionalFeaturesSchema = featureSchema({
	number: EnglishSymbolNumber,
});

export const EnglishSymbolInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishSymbolExtPos, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-SYM.html
});
