import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import { EnglishFeature } from "../shared/english-common-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
const EnglishAuxiliaryNumber = EnglishFeature.Number.extract(["Plur", "Sing"]);

// https://universaldependencies.org/u/feat/Style.html
const EnglishAuxiliaryStyle = EnglishFeature.Style.extract(["Arch", "Vrnc"]);

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-VerbForm.html
const EnglishAuxiliaryVerbForm = EnglishFeature.VerbForm.extract([
	"Fin",
	"Inf",
	"Part",
]);

const EnglishAuxiliaryInflectionalFeaturesSchema = featureSchema({
	mood: EnglishFeature.Mood, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Mood.html
	number: EnglishAuxiliaryNumber,
	person: EnglishFeature.Person, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Person.html
	tense: EnglishFeature.Tense, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Tense.html
	verbForm: EnglishAuxiliaryVerbForm,
});

const EnglishAuxiliaryInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	style: EnglishAuxiliaryStyle,
});

export const EnglishAuxiliarySchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishAuxiliaryInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishAuxiliaryInherentFeaturesSchema,
	pos: "AUX",
});
