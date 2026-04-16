import { UniversalFeature } from "../../../../../universal/enums/feature";
import {
	featureSchema,
	featureSpecificValueSets,
} from "../../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";
import { HebrewFeature } from "../shared/hebrew-common-enums";

const HebrewNounInflectionalFeaturesSchema = featureSchema({
	definite: HebrewFeature.Definite,
	number: featureSpecificValueSets(HebrewFeature.Number, [["Dual", "Plur"]]),
});

const HebrewNounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	gender: featureSpecificValueSets(HebrewFeature.Gender, [["Fem", "Masc"]]),
});

export const HebrewNounSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema: HebrewNounInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewNounInherentFeaturesSchema,
	pos: "NOUN",
});
