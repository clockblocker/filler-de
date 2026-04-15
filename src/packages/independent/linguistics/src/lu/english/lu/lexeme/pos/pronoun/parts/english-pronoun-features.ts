import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import {
	EnglishPronounExtPos,
	EnglishPronounPronType,
	EnglishPronounStyle,
} from "./english-pronoun-enums";

const EnglishPronounNumber = UniversalFeature.GrammaticalNumber.extract([
	"Plur",
	"Sing",
]);

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-PRON.html
// - https://universaldependencies.org/docs/en/feat/PronType.html
// - https://universaldependencies.org/u/feat/Style.html
// - https://universaldependencies.org/u/feat/Typo.html
export const EnglishPronounInflectionalFeaturesSchema = featureSchema({
	case: EnglishFeature.Case.optional(),
	gender: EnglishFeature.Gender.optional(),
	number: EnglishPronounNumber.optional(),
	reflex: UniversalFeature.Reflex.optional(),
});

export const EnglishPronounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	extPos: EnglishPronounExtPos.optional(),
	person: EnglishFeature.Person.optional(),
	poss: UniversalFeature.Poss.optional(),
	pronType: EnglishPronounPronType.optional(),
	style: EnglishPronounStyle.optional(),
	typo: EnglishFeature.Typo.optional(),
});
