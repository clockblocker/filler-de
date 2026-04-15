import {
	featureSchema,
	featureSpecificValueSets,
} from "../../../../universal/helpers/schema-targets";
import { UniversalFeature } from "../../../../universal/enums/feature";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";
import { HebrewFeature } from "../shared/hebrew-common-enums";

const HebrewAdjectiveInflectionalFeaturesSchema = featureSchema({
	definite: HebrewFeature.Definite,
	gender: featureSpecificValueSets(HebrewFeature.Gender, [["Fem", "Masc"]]),
	number: HebrewFeature.Number.extract(["Plur", "Sing"]),
});

const HebrewAdjectiveInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
});

export const HebrewAdjectiveSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema: HebrewAdjectiveInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewAdjectiveInherentFeaturesSchema,
	pos: "ADJ",
});
