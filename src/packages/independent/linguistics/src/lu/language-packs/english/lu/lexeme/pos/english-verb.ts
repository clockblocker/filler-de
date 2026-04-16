import { UniversalFeature } from "../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import { EnglishFeature } from "../shared/english-common-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-VERB.html
const EnglishVerbExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"CCONJ",
	"PROPN",
]);

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
const EnglishVerbNumber = EnglishFeature.Number.extract(["Plur", "Sing"]);

// https://universaldependencies.org/u/feat/Style.html
const EnglishVerbStyle = EnglishFeature.Style.extract(["Expr", "Vrnc"]);
const EnglishVerbVerbForm = EnglishFeature.VerbForm;

const EnglishVerbInflectionalFeaturesSchema = featureSchema({
	mood: EnglishFeature.Mood, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Mood.html
	number: EnglishVerbNumber,
	person: EnglishFeature.Person, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Person.html
	tense: EnglishFeature.Tense, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Tense.html
	verbForm: EnglishVerbVerbForm, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-VerbForm.html
	voice: UniversalFeature.Voice.extract(["Pass"]), // https://universaldependencies.org/en/feat/Voice.html
});

const EnglishVerbInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishVerbExtPos,
	hasGovPrep: UniversalFeature.HasGovPrep,
	phrasal: UniversalFeature.Phrasal,
	style: EnglishVerbStyle,
});

export const EnglishVerbSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishVerbInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishVerbInherentFeaturesSchema,
	pos: "VERB",
});
