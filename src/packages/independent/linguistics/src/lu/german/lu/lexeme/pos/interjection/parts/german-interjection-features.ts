import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";

export const GermanInterjectionInflectionalFeaturesSchema = featureSchema({});

export const GermanInterjectionInherentFeaturesSchema = featureSchema({
	partType: UniversalFeature.PartType.extract(["Res"]),
});
