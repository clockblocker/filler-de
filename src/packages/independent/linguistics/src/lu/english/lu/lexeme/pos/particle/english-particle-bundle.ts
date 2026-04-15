import { buildEnglishLexemeBundle } from "../../shared/build-english-lexeme-bundle";
import {
	EnglishParticleInflectionalFeaturesSchema,
	EnglishParticleInherentFeaturesSchema,
} from "./parts/english-particle-features";
export const EnglishParticleSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishParticleInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishParticleInherentFeaturesSchema,
	pos: "PART",
});
