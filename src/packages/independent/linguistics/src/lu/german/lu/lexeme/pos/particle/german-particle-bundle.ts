import { buildGermanLexemeBundle } from "../../shared/build-german-lexeme-bundle";
import {
	GermanParticleInflectionalFeaturesSchema,
	GermanParticleInherentFeaturesSchema,
} from "./parts/german-particle-features";
import {
	GermanParticleLexicalRelationsSchema,
	GermanParticleMorphologicalRelationsSchema,
} from "./parts/german-particle-relations";

export const GermanParticleSchemas = buildGermanLexemeBundle({
	inflectionalFeaturesSchema: GermanParticleInflectionalFeaturesSchema,
	inherentFeaturesSchema: GermanParticleInherentFeaturesSchema,
	lexicalRelationsSchema: GermanParticleLexicalRelationsSchema,
	morphologicalRelationsSchema: GermanParticleMorphologicalRelationsSchema,
	pos: "PART",
});
