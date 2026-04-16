import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import { GermanFeature } from "../shared/german-common-enums";

const GermanProperNounInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case,
	number: GermanFeature.Number,
});

const GermanProperNounInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	foreign: UniversalFeature.Foreign,
	gender: GermanFeature.Gender,
});

export const GermanProperNounSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanProperNounInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanProperNounInherentFeaturesSchema,
	pos: "PROPN",
});
