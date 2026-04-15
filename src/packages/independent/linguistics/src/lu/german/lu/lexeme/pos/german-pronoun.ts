import { UniversalFeature } from "../../../../universal/enums/feature";
import {
	featureSchema,
	featureSpecificValueSets,
} from "../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../shared/german-common-enums";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";

const GermanPronounPronType = UniversalFeature.PronType.extract([
	"Dem",
	"Ind",
	"Int",
	"Neg",
	"Prs",
	"Rcp",
	"Rel",
	"Tot",
]);

const GermanPronounInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	gender: GermanFeature.Gender,
	number: GermanFeature.Number,
	reflex: UniversalFeature.Reflex,
});

const GermanPronounInherentFeaturesSchema = featureSchema({
	extPos: UniversalFeature.ExtPos.extract(["DET"]),
	foreign: UniversalFeature.Foreign,
	person: GermanFeature.Person,
	polite: GermanFeature.Polite,
	poss: UniversalFeature.Poss,
	pronType: featureSpecificValueSets(GermanPronounPronType, [
		["Dem", "Rel"],
		["Int", "Rel"],
	]),
});

export const GermanPronounSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanPronounInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanPronounInherentFeaturesSchema,
	pos: "PRON",
});
