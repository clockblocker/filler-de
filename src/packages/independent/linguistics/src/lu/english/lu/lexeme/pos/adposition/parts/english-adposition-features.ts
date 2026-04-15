import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";

// https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-ADP.html
const EnglishAdpositionExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"ADV",
	"SCONJ",
]);

export const EnglishAdpositionInflectionalFeaturesSchema = featureSchema({});

export const EnglishAdpositionInherentFeaturesSchema = featureSchema({
	abbr: UniversalFeature.Abbr,
	extPos: EnglishAdpositionExtPos,
});
