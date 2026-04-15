import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";

export const GermanSubordinatingConjunctionInflectionalFeaturesSchema =
	featureSchema({});

export const GermanSubordinatingConjunctionInherentFeaturesSchema =
	featureSchema({
		conjType: UniversalFeature.ConjType.extract(["Comp"]),
	});
