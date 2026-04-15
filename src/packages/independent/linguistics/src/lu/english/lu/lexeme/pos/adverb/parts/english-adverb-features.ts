import { UniversalFeature } from "../../../../../../universal/enums/feature";
import {
	featureSchema,
	featureValueSet,
} from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import {
	EnglishAdverbExtPos,
	EnglishAdverbNumForm,
	EnglishAdverbNumType,
	EnglishAdverbPronType,
	EnglishAdverbStyle,
} from "./english-adverb-enums";

export const EnglishAdverbInflectionalFeaturesSchema = featureSchema({
	degree: EnglishFeature.Degree, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Degree.html
});

export const EnglishAdverbInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishAdverbExtPos, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADV.html
	numForm: EnglishAdverbNumForm, // https://universaldependencies.org/u/feat/NumForm.html
	numType: EnglishAdverbNumType, // https://universaldependencies.org/u/feat/NumType.html
	pronType: featureValueSet(EnglishAdverbPronType), // https://universaldependencies.org/docs/en/feat/PronType.html
	style: EnglishAdverbStyle, // https://universaldependencies.org/u/feat/Style.html
});
