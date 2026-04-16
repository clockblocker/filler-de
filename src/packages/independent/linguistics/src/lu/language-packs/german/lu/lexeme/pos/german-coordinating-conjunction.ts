import { UniversalFeature } from "../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";

const GermanCoordinatingConjunctionInflectionalFeaturesSchema = featureSchema(
	{},
);

const GermanCoordinatingConjunctionInherentFeaturesSchema = featureSchema({
	conjType: UniversalFeature.ConjType.extract(["Comp"]),
});

export const GermanCoordinatingConjunctionSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema:
		GermanCoordinatingConjunctionInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanCoordinatingConjunctionInherentFeaturesSchema,
	pos: "CCONJ",
});
