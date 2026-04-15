import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildHebrewLexemeBundle } from "../shared/build-hebrew-lexeme-bundle";
import { HebrewFeature } from "../shared/hebrew-common-enums";

const HebrewSubordinatingConjunctionInflectionalFeaturesSchema = featureSchema({});

const HebrewSubordinatingConjunctionInherentFeaturesSchema = featureSchema({
	case: HebrewFeature.Case.extract(["Tem"]),
});

export const HebrewSubordinatingConjunctionSchemas = buildHebrewLexemeBundle({
	inflectionalFeaturesSchema:
		HebrewSubordinatingConjunctionInflectionalFeaturesSchema,
	inherentFeaturesSchema: HebrewSubordinatingConjunctionInherentFeaturesSchema,
	pos: "SCONJ",
});
