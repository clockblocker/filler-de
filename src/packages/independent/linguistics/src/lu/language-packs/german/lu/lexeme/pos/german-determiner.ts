import { UniversalFeature } from "../../../../../universal/enums/feature";
import {
	featureSchema,
	featureSpecificValueSets,
	featureValueSet,
} from "../../../../../universal/helpers/schema-targets";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import { GermanFeature } from "../shared/german-common-enums";

const GermanDeterminerNumType = UniversalFeature.NumType.extract([
	"Card",
	"Ord",
]);

const GermanDeterminerPronType = UniversalFeature.PronType.extract([
	"Art",
	"Dem",
	"Emp",
	"Exc",
	"Ind",
	"Int",
	"Neg",
	"Prs",
	"Rel",
	"Tot",
]);

const GermanDeterminerInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	degree: GermanFeature.Degree,
	gender: featureSpecificValueSets(GermanFeature.Gender, [["Masc", "Neut"]]),
	"gender[psor]": featureValueSet(GermanFeature.Gender),
	number: GermanFeature.Number,
	"number[psor]": GermanFeature.Number,
});

const GermanDeterminerInherentFeaturesSchema = featureSchema({
	definite: GermanFeature.Definite,
	extPos: UniversalFeature.ExtPos.extract(["ADV", "DET"]),
	foreign: UniversalFeature.Foreign,
	numType: GermanDeterminerNumType,
	person: GermanFeature.Person,
	polite: GermanFeature.Polite,
	poss: UniversalFeature.Poss,
	pronType: featureSpecificValueSets(GermanDeterminerPronType, [
		["Int", "Rel"],
	]),
});

export const GermanDeterminerSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanDeterminerInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanDeterminerInherentFeaturesSchema,
	pos: "DET",
});
