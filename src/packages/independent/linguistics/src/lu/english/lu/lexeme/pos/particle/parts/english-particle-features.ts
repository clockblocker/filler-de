import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";

const EnglishParticleExtPos = UniversalFeature.ExtPos.extract(["CCONJ"]);

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-PART.html
// - https://universaldependencies.org/u/feat/ExtPos.html
// - https://universaldependencies.org/u/feat/Typo.html
export const EnglishParticleInflectionalFeaturesSchema = featureSchema({});

export const EnglishParticleInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	extPos: EnglishParticleExtPos.optional(),
	polarity: UniversalFeature.Polarity.extract(["Neg"]).optional(),
	typo: EnglishFeature.Typo.optional(),
});
