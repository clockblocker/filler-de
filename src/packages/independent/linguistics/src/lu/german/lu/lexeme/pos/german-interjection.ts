import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";

const GermanInterjectionInflectionalFeaturesSchema = featureSchema({});

const GermanInterjectionInherentFeaturesSchema = featureSchema({
	partType: UniversalFeature.PartType.extract(["Res"]),
});

export const GermanInterjectionSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanInterjectionInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanInterjectionInherentFeaturesSchema,
	pos: "INTJ",
});
