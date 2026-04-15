import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishNumeralExtPos,
	EnglishNumeralNumForm,
	EnglishNumeralNumType,
} from "./english-numeral-enums";

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-NUM.html
// - https://universaldependencies.org/u/feat/NumForm.html
export const EnglishNumeralInflectionalFeaturesSchema = featureSchema({});

export const EnglishNumeralInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishNumeralExtPos,
	numForm: EnglishNumeralNumForm,
	numType: EnglishNumeralNumType,
});
