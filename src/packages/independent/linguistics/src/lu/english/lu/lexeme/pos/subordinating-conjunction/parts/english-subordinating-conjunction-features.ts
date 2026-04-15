import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";

const EnglishSubordinatingConjunctionExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"SCONJ",
]);

const EnglishSubordinatingConjunctionStyle = UniversalFeature.Style.extract([
	"Vrnc",
]);

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-SCONJ.html
// - https://universaldependencies.org/u/feat/ExtPos.html
// - https://universaldependencies.org/u/feat/Style.html
// - https://universaldependencies.org/u/feat/Typo.html
export const EnglishSubordinatingConjunctionInflectionalFeaturesSchema =
	featureSchema({});

export const EnglishSubordinatingConjunctionInherentFeaturesSchema =
	featureSchema({
		abbr: UniversalFeature.Abbr.optional(),
		extPos: EnglishSubordinatingConjunctionExtPos.optional(),
		style: EnglishSubordinatingConjunctionStyle.optional(),
		typo: UniversalFeature.Typo.optional(),
	});
