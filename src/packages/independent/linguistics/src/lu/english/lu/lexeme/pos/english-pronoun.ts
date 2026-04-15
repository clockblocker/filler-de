import { UniversalFeature } from "../../../../universal/enums/feature";
import {
	featureSchema,
	featureValueSet,
} from "../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../shared/english-common-enums";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-PRON.html
const EnglishPronounExtPos = UniversalFeature.ExtPos.extract(["ADV", "PRON"]);

// https://universaldependencies.org/docs/en/feat/PronType.html
const EnglishPronounPronType = EnglishFeature.PronType.extract([
	"Dem",
	"Emp",
	"Ind",
	"Int",
	"Neg",
	"Prs",
	"Rcp",
	"Rel",
	"Tot",
]);

// https://universaldependencies.org/u/feat/Style.html
const EnglishPronounStyle = EnglishFeature.Style.extract([
	"Arch",
	"Coll",
	"Expr",
	"Slng",
	"Vrnc",
]);

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Number.html
const EnglishPronounNumber = EnglishFeature.Number.extract(["Plur", "Sing"]);

const EnglishPronounInflectionalFeaturesSchema = featureSchema({
	case: EnglishFeature.Case, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Case.html
	gender: EnglishFeature.Gender, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Gender.html
	number: EnglishPronounNumber,
	reflex: UniversalFeature.Reflex,
});

const EnglishPronounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishPronounExtPos, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-PRON.html
	person: EnglishFeature.Person, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Person.html
	poss: UniversalFeature.Poss,
	pronType: featureValueSet(EnglishPronounPronType), // https://universaldependencies.org/docs/en/feat/PronType.html
	style: EnglishPronounStyle, // https://universaldependencies.org/u/feat/Style.html
});

export const EnglishPronounSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishPronounInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishPronounInherentFeaturesSchema,
	pos: "PRON",
});
