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
// - https://universaldependencies.org/u/feat/Typo.html
export const EnglishDeterminerInflectionalFeaturesSchema = featureSchema({
	number: EnglishDeterminerNumber.optional(),
});

export const EnglishDeterminerInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	definite: EnglishFeature.Definite.optional(),
	extPos: EnglishDeterminerExtPos.optional(),
	numForm: EnglishDeterminerNumForm.optional(),
	numType: EnglishDeterminerNumType.optional(),
	pronType: EnglishDeterminerPronType.optional(),
	style: EnglishDeterminerStyle.optional(),
	typo: EnglishFeature.Typo.optional(),
});
