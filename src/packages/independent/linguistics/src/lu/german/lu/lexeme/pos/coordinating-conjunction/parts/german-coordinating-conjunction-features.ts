import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";

export const GermanCoordinatingConjunctionInflectionalFeaturesSchema =
	featureSchema({});

export const GermanCoordinatingConjunctionInherentFeaturesSchema =
	featureSchema({
		conjType: UniversalFeature.ConjType.extract(["Comp"]),
	});
