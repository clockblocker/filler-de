import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";

const EnglishAdpositionExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"ADV",
	"SCONJ",
]);

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADP.html
// - https://universaldependencies.org/u/feat/ExtPos.html
// - https://universaldependencies.org/u/feat/Typo.html
export const EnglishAdpositionInflectionalFeaturesSchema = featureSchema({});

export const EnglishAdpositionInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr.optional(),
	extPos: EnglishAdpositionExtPos.optional(),
	typo: UniversalFeature.Typo.optional(),
});
