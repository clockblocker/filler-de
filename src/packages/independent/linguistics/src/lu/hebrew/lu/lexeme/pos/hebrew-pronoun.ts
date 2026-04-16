import { UniversalFeature } from "../../../../universal/enums/feature";
import {
	featureSchema,
	featureSpecificValueSets,
} from "../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";
import { HebrewFeature } from "../shared/hebrew-common-enums";

const HebrewPronounInflectionalFeaturesSchema = featureSchema({
	gender: featureSpecificValueSets(HebrewFeature.Gender, [["Fem", "Masc"]]),
	number: HebrewFeature.Number.extract(["Plur", "Sing"]),
	person: HebrewFeature.Person,
});

const HebrewPronounInherentFeaturesSchema = featureSchema({
	definite: HebrewFeature.Definite.extract(["Def"]),
	pronType: HebrewFeature.PronType.extract(["Dem", "Ind", "Int", "Prs"]),
	reflex: UniversalFeature.Reflex,
});

export const HebrewPronounSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema: HebrewPronounInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewPronounInherentFeaturesSchema,
	pos: "PRON",
});
