import { UniversalFeature } from "../../../../../../universal/enums/feature";
import {
	featureSchema,
	featureValueSet,
} from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import {
	EnglishPronounExtPos,
	EnglishPronounPronType,
	EnglishPronounStyle,
} from "./english-pronoun-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
const EnglishPronounNumber = EnglishFeature.Number.extract(["Plur", "Sing"]);

export const EnglishPronounInflectionalFeaturesSchema = featureSchema({
	case: EnglishFeature.Case, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Case.html
	gender: EnglishFeature.Gender, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Gender.html
	number: EnglishPronounNumber,
	reflex: UniversalFeature.Reflex,
});

export const EnglishPronounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishPronounExtPos, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-PRON.html
	person: EnglishFeature.Person, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Person.html
	poss: UniversalFeature.Poss,
	pronType: featureValueSet(EnglishPronounPronType), // https://universaldependencies.org/docs/en/feat/PronType.html
	style: EnglishPronounStyle, // https://universaldependencies.org/u/feat/Style.html
});
