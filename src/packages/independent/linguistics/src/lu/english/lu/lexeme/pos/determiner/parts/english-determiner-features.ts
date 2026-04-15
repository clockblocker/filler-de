import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import {
	EnglishDeterminerExtPos,
	EnglishDeterminerNumForm,
	EnglishDeterminerNumType,
	EnglishDeterminerPronType,
	EnglishDeterminerStyle,
} from "./english-determiner-enums";

const EnglishDeterminerNumber = UniversalFeature.GrammaticalNumber.extract([
	"Plur",
	"Sing",
]);

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-DET.html
// - https://universaldependencies.org/docs/en/feat/PronType.html
// - https://universaldependencies.org/u/feat/NumForm.html
// - https://universaldependencies.org/u/feat/Style.html
export const EnglishDeterminerInflectionalFeaturesSchema = featureSchema({
	number: EnglishDeterminerNumber,
});

export const EnglishDeterminerInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	definite: EnglishFeature.Definite,
	extPos: EnglishDeterminerExtPos,
	numForm: EnglishDeterminerNumForm,
	numType: EnglishDeterminerNumType,
	pronType: EnglishDeterminerPronType,
	style: EnglishDeterminerStyle,
});
