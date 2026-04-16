import { UniversalFeature } from "../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";

const GermanSubordinatingConjunctionInflectionalFeaturesSchema = featureSchema(
	{},
);

const GermanSubordinatingConjunctionInherentFeaturesSchema = featureSchema({
	conjType: UniversalFeature.ConjType.extract(["Comp"]),
});

export const GermanSubordinatingConjunctionSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema:
		GermanSubordinatingConjunctionInflectionalFeaturesSchema,
	inherentFeaturesSchema:
		GermanSubordinatingConjunctionInherentFeaturesSchema,
	pos: "SCONJ",
});
