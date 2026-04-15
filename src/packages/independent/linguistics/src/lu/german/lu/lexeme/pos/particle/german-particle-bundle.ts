import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanParticleInflectionalFeaturesSchema,
	GermanParticleInherentFeaturesSchema,
} from "./parts/german-particle-features";

export const GermanParticleSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanParticleInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanParticleInherentFeaturesSchema,
	pos: "PART",
});
