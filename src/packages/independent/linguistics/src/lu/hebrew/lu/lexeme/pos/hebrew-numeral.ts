import {
	featureSchema,
	featureSpecificValueSets,
} from "../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";
import { HebrewFeature } from "../shared/hebrew-common-enums";

const HebrewNumeralInflectionalFeaturesSchema = featureSchema({
	definite: HebrewFeature.Definite,
	gender: featureSpecificValueSets(HebrewFeature.Gender, [["Fem", "Masc"]]),
	number: featureSpecificValueSets(HebrewFeature.Number, [["Dual", "Plur"]]),
});

const HebrewNumeralInherentFeaturesSchema = featureSchema({});

export const HebrewNumeralSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema: HebrewNumeralInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewNumeralInherentFeaturesSchema,
	pos: "NUM",
});
