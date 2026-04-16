import { UniversalFeature } from "../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../universal/helpers/schema-targets";
import { buildEnglishLexemeBundle } from "../shared/build-english-lexeme-bundle";
import { EnglishFeature } from "../shared/english-common-enums";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-PART.html
const EnglishParticleExtPos = UniversalFeature.ExtPos.extract(["CCONJ"]);

const EnglishParticleInflectionalFeaturesSchema = featureSchema({});

const EnglishParticleInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishParticleExtPos,
	polarity: EnglishFeature.Polarity.extract(["Neg"]), // https://universaldependencies.org/treebanks/en_ewt/en_ewt-feat-Polarity.html
});

export const EnglishParticleSchemas = buildEnglishLexemeBundle({
	inflectionalFeaturesSchema: EnglishParticleInflectionalFeaturesSchema,
	inherentFeaturesSchema: EnglishParticleInherentFeaturesSchema,
	pos: "PART",
});
