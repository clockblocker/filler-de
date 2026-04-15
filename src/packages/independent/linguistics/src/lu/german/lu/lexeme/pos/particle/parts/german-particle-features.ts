import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanPolarity } from "../../../shared/german-common-enums";

export const GermanParticleInflectionalFeaturesSchema = featureSchema({});

export const GermanParticleInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	polarity: GermanPolarity.optional(),
});
