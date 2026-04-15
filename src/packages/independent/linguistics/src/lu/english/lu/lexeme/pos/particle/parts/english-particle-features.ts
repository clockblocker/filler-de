import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishPolarity } from "../../../shared/english-common-enums";

export const EnglishParticleInflectionalFeaturesSchema = featureSchema({});

export const EnglishParticleInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	polarity: EnglishPolarity.optional(),
});
