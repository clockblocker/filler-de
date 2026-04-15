import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import {
	EnglishAdverbExtPos,
	EnglishAdverbNumForm,
	EnglishAdverbNumType,
	EnglishAdverbPronType,
	EnglishAdverbStyle,
} from "./english-adverb-enums";

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADV.html
// - https://universaldependencies.org/u/feat/NumForm.html
// - https://universaldependencies.org/u/feat/Style.html
export const EnglishAdverbInflectionalFeaturesSchema = featureSchema({
	degree: EnglishFeature.Degree,
});

export const EnglishAdverbInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishAdverbExtPos,
	numForm: EnglishAdverbNumForm,
	numType: EnglishAdverbNumType,
	pronType: EnglishAdverbPronType,
	style: EnglishAdverbStyle,
});
