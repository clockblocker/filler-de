import {
	featureSchema,
	featureSpecificValueSets,
} from "../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";
import { HebrewFeature } from "../shared/hebrew-common-enums";

const HebrewDeterminerInflectionalFeaturesSchema = featureSchema({
	definite: HebrewFeature.Definite,
	gender: featureSpecificValueSets(HebrewFeature.Gender, [["Fem", "Masc"]]),
	number: HebrewFeature.Number.extract(["Plur", "Sing"]),
});

const HebrewDeterminerInherentFeaturesSchema = featureSchema({
	pronType: HebrewFeature.PronType.extract(["Art", "Int"]),
});

export const HebrewDeterminerSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema: HebrewDeterminerInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewDeterminerInherentFeaturesSchema,
	pos: "DET",
});
