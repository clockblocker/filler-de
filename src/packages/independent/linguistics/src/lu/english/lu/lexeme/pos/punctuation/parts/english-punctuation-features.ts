import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-PUNCT.html
// - https://universaldependencies.org/u/feat/Typo.html
export const EnglishPunctuationInflectionalFeaturesSchema = featureSchema({});

export const EnglishPunctuationInherentFeaturesSchema = featureSchema({
	typo: UniversalFeature.Typo.optional(),
});
