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
// - https://universaldependencies.org/u/feat/Typo.html
export const EnglishVerbInflectionalFeaturesSchema = featureSchema({
	mood: EnglishFeature.Mood.optional(),
	number: EnglishVerbNumber.optional(),
	person: EnglishFeature.Person.optional(),
	tense: EnglishFeature.Tense.optional(),
	verbForm: EnglishVerbVerbForm.optional(),
	voice: UniversalFeature.Voice.extract(["Pass"]).optional(),
});

export const EnglishVerbInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	extPos: EnglishVerbExtPos.optional(),
	governedPreposition: UniversalFeature.GovernedPreposition.optional(),
	phrasal: UniversalFeature.Phrasal.optional(),
	style: EnglishVerbStyle.optional(),
	typo: EnglishFeature.Typo.optional(),
});
