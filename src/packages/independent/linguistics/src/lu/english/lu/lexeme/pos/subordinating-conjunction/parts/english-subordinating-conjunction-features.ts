import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";

const EnglishSubordinatingConjunctionExtPos = UniversalFeature.ExtPos.extract([
	"ADP",
	"SCONJ",
]);

const EnglishSubordinatingConjunctionStyle = EnglishFeature.Style.extract([
	"Vrnc",
]);

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-SCONJ.html
// - https://universaldependencies.org/u/feat/ExtPos.html
// - https://universaldependencies.org/u/feat/Style.html
export const EnglishSubordinatingConjunctionInflectionalFeaturesSchema =
	featureSchema({});

export const EnglishSubordinatingConjunctionInherentFeaturesSchema =
	featureSchema({
		abbr: UniversalFeature.Abbr,
		extPos: EnglishSubordinatingConjunctionExtPos,
		style: EnglishSubordinatingConjunctionStyle,
	});
