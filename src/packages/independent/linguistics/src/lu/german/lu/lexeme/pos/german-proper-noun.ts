import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../shared/german-common-enums";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";

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
