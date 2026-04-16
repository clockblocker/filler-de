import { UniversalFeature } from "../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildGermanLexemeBundle } from "../shared/build-german-lexeme-bundle";
import { GermanFeature } from "../shared/german-common-enums";

const GermanParticleInflectionalFeaturesSchema = featureSchema({});

const GermanParticleInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	foreign: UniversalFeature.Foreign,
	partType: UniversalFeature.PartType.extract(["Inf"]),
	polarity: GermanFeature.Polarity,
});

export const GermanParticleSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanParticleInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanParticleInherentFeaturesSchema,
	pos: "PART",
});
