import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";

const EnglishVerbExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"CCONJ",
	"PROPN",
]);

const EnglishVerbNumber = UniversalFeature.GrammaticalNumber.extract([
	"Plur",
	"Sing",
]);

const EnglishVerbStyle = EnglishFeature.Style.extract(["Expr", "Vrnc"]);
const EnglishVerbVerbForm = UniversalFeature.VerbForm.extract([
	"Fin",
	"Ger",
	"Inf",
	"Part",
]);

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-VERB.html
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-VerbForm.html
// - https://universaldependencies.org/en/feat/Voice.html
// - https://universaldependencies.org/u/feat/Style.html
export const EnglishVerbInflectionalFeaturesSchema = featureSchema({
	mood: EnglishFeature.Mood,
	number: EnglishVerbNumber,
	person: EnglishFeature.Person,
	tense: EnglishFeature.Tense,
	verbForm: EnglishVerbVerbForm,
	voice: UniversalFeature.Voice.extract(["Pass"]),
});

export const EnglishVerbInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishVerbExtPos,
	governedPreposition: UniversalFeature.GovernedPreposition,
	phrasal: UniversalFeature.Phrasal,
	style: EnglishVerbStyle,
});
