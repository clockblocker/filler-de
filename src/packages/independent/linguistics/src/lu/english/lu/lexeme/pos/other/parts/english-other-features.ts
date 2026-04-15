import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import { EnglishOtherExtPos } from "./english-other-enums";

// Sources:
// - https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-X.html
// - https://universaldependencies.org/u/feat/Typo.html
export const EnglishOtherInflectionalFeaturesSchema = featureSchema({});

export const EnglishOtherInherentFeaturesSchema = featureSchema({
	extPos: EnglishOtherExtPos.optional(),
	foreign: UniversalFeature.Foreign.optional(),
	typo: EnglishFeature.Typo.optional(),
});
