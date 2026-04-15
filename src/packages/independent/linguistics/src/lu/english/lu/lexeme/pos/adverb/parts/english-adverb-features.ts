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
// - https://universaldependencies.org/u/feat/Typo.html
export const EnglishAdverbInflectionalFeaturesSchema = featureSchema({
	degree: EnglishFeature.Degree.optional(),
});

export const EnglishAdverbInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	extPos: EnglishAdverbExtPos.optional(),
	numForm: EnglishAdverbNumForm.optional(),
	numType: EnglishAdverbNumType.optional(),
	pronType: EnglishAdverbPronType.optional(),
	style: EnglishAdverbStyle.optional(),
	typo: EnglishFeature.Typo.optional(),
});
