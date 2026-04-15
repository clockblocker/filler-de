import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";

export const GermanParticleInflectionalFeaturesSchema = featureSchema({});

export const GermanParticleInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	foreign: UniversalFeature.Foreign,
	polarity: GermanFeature.Polarity,
});
