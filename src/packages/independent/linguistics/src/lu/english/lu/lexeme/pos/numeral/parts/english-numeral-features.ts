import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import {
	EnglishNumeralExtPos,
	EnglishNumeralNumForm,
	EnglishNumeralNumType,
} from "./english-numeral-enums";

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-NUM.html
// - https://universaldependencies.org/u/feat/NumForm.html
// - https://universaldependencies.org/u/feat/Typo.html
export const EnglishNumeralInflectionalFeaturesSchema = featureSchema({});

export const EnglishNumeralInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	extPos: EnglishNumeralExtPos.optional(),
	numForm: EnglishNumeralNumForm.optional(),
	numType: EnglishNumeralNumType.optional(),
	typo: EnglishFeature.Typo.optional(),
});
