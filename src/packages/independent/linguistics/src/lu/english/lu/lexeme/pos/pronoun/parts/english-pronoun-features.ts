import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import {
	EnglishPronounExtPos,
	EnglishPronounPronType,
	EnglishPronounStyle,
} from "./english-pronoun-enums";

const EnglishPronounNumber = EnglishFeature.Number.extract(["Plur", "Sing"]);

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-PRON.html
// - https://universaldependencies.org/docs/en/feat/PronType.html
// - https://universaldependencies.org/u/feat/Style.html
export const EnglishPronounInflectionalFeaturesSchema = featureSchema({
	case: EnglishFeature.Case,
	gender: EnglishFeature.Gender,
	number: EnglishPronounNumber,
	reflex: UniversalFeature.Reflex,
});

export const EnglishPronounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishPronounExtPos,
	person: EnglishFeature.Person,
	poss: UniversalFeature.Poss,
	pronType: EnglishPronounPronType,
	style: EnglishPronounStyle,
});
