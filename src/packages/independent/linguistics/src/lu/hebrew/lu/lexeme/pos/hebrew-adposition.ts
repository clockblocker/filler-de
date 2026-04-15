import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";
import { HebrewFeature } from "../shared/hebrew-common-enums";

const HebrewAdpositionInflectionalFeaturesSchema = featureSchema({});

const HebrewAdpositionInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	case: HebrewFeature.Case.extract(["Acc", "Gen"]),
});

export const HebrewAdpositionSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema: HebrewAdpositionInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewAdpositionInherentFeaturesSchema,
	pos: "ADP",
});
