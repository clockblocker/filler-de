import { UniversalFeature } from "../../../../../universal/enums/feature";
import {
	featureSchema,
	featureSpecificValueSets,
} from "../../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";
import { HebrewFeature } from "../shared/hebrew-common-enums";

const HebrewProperNounInflectionalFeaturesSchema = featureSchema({
	number: HebrewFeature.Number.extract(["Plur", "Sing"]),
});

const HebrewProperNounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	gender: featureSpecificValueSets(HebrewFeature.Gender, [["Fem", "Masc"]]),
});

export const HebrewProperNounSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema: HebrewProperNounInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewProperNounInherentFeaturesSchema,
	pos: "PROPN",
});
