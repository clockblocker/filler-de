import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanVerbalInflectionalFeaturesSchema } from "../../../shared/german-verbal-inflection-features";

export const GermanVerbInflectionalFeaturesSchema =
	GermanVerbalInflectionalFeaturesSchema;

export const GermanVerbInherentFeaturesSchema = featureSchema({
	governedPreposition: UniversalFeature.GovernedPreposition.optional(),
	lexicallyReflexive: UniversalFeature.LexicallyReflexive.optional(),
	separable: UniversalFeature.Separable.optional(),
});
