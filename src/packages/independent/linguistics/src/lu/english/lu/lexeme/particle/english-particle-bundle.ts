import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import {
	EnglishParticleInflectionalFeaturesSchema,
	EnglishParticleInherentFeaturesSchema,
} from "./parts/english-particle-features";
import {
	EnglishParticleLexicalRelationsSchema,
	EnglishParticleMorphologicalRelationsSchema,
} from "./parts/english-particle-relations";

export const EnglishParticleSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishParticleInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishParticleInherentFeaturesSchema,
	lexicalRelationsSchema: EnglishParticleLexicalRelationsSchema,
	morphologicalRelationsSchema: EnglishParticleMorphologicalRelationsSchema,
	pos: "PART",
});
