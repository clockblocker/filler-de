import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";

const EnglishAuxiliaryNumber = UniversalFeature.GrammaticalNumber.extract([
	"Plur",
	"Sing",
]);

const EnglishAuxiliaryStyle = EnglishFeature.Style.extract(["Arch", "Vrnc"]);
const EnglishAuxiliaryVerbForm = UniversalFeature.VerbForm.extract([
	"Fin",
	"Inf",
	"Part",
]);

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-AUX.html
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-VerbForm.html
// - https://universaldependencies.org/u/feat/Style.html
// - https://universaldependencies.org/u/feat/Typo.html
export const EnglishAuxiliaryInflectionalFeaturesSchema = featureSchema({
	mood: EnglishFeature.Mood.optional(),
	number: EnglishAuxiliaryNumber.optional(),
	person: EnglishFeature.Person.optional(),
	tense: EnglishFeature.Tense.optional(),
	verbForm: EnglishAuxiliaryVerbForm.optional(),
});

export const EnglishAuxiliaryInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	style: EnglishAuxiliaryStyle.optional(),
	typo: EnglishFeature.Typo.optional(),
});
