import { UniversalFeature } from "../../../../universal/enums/feature";
import { featureSchema } from "../../../../universal/helpers/schema-targets";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import { GermanVerbalInflectionalFeaturesSchema } from "../shared/german-verbal-inflection-features";

const GermanAuxiliaryInflectionalFeaturesSchema =
	GermanVerbalInflectionalFeaturesSchema;

const GermanAuxiliaryInherentFeaturesSchema = featureSchema({
	verbType: UniversalFeature.VerbType.extract(["Mod"]),
});

export const GermanAuxiliarySchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanAuxiliaryInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanAuxiliaryInherentFeaturesSchema,
	pos: "AUX",
});
