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
export const EnglishAuxiliaryInflectionalFeaturesSchema = featureSchema({
	mood: EnglishFeature.Mood,
	number: EnglishAuxiliaryNumber,
	person: EnglishFeature.Person,
	tense: EnglishFeature.Tense,
	verbForm: EnglishAuxiliaryVerbForm,
});

export const EnglishAuxiliaryInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	style: EnglishAuxiliaryStyle,
});
