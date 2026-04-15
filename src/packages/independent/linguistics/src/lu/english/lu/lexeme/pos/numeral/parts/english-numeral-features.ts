import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishNumeralExtPos,
	EnglishNumeralNumForm,
	EnglishNumeralNumType,
} from "./english-numeral-enums";

export const EnglishNumeralInflectionalFeaturesSchema = featureSchema({});

export const EnglishNumeralInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishNumeralExtPos, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-NUM.html
	numForm: EnglishNumeralNumForm, // https://universaldependencies.org/u/feat/NumForm.html
	numType: EnglishNumeralNumType, // https://universaldependencies.org/u/feat/NumType.html
});
