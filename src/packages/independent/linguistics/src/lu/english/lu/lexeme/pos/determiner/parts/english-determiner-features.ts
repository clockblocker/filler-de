import { UniversalFeature } from "../../../../../../universal/enums/feature";
import {
	featureSchema,
	featureValueSet,
} from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import {
	EnglishDeterminerExtPos,
	EnglishDeterminerNumForm,
	EnglishDeterminerNumType,
	EnglishDeterminerPronType,
	EnglishDeterminerStyle,
} from "./english-determiner-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
const EnglishDeterminerNumber = EnglishFeature.Number.extract(["Plur", "Sing"]);

export const EnglishDeterminerInflectionalFeaturesSchema = featureSchema({
	number: EnglishDeterminerNumber,
});

export const EnglishDeterminerInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	definite: EnglishFeature.Definite, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Definite.html
	extPos: EnglishDeterminerExtPos, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-DET.html
	numForm: EnglishDeterminerNumForm, // https://universaldependencies.org/u/feat/NumForm.html
	numType: EnglishDeterminerNumType, // https://universaldependencies.org/u/feat/NumType.html
	pronType: featureValueSet(EnglishDeterminerPronType), // https://universaldependencies.org/docs/en/feat/PronType.html
	style: EnglishDeterminerStyle, // https://universaldependencies.org/u/feat/Style.html
});
