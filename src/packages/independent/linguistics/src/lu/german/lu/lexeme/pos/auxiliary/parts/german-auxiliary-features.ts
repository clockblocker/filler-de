import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanVerbalInflectionalFeaturesSchema } from "../../../shared/german-verbal-inflection-features";

export const GermanAuxiliaryInflectionalFeaturesSchema =
	GermanVerbalInflectionalFeaturesSchema;

export const GermanAuxiliaryInherentFeaturesSchema = featureSchema({
	verbType: UniversalFeature.VerbType.extract(["Mod"]),
});
