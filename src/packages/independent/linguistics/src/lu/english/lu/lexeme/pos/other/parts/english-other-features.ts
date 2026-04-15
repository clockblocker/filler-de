import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishOtherExtPos } from "./english-other-enums";

export const EnglishOtherInflectionalFeaturesSchema = featureSchema({});

export const EnglishOtherInherentFeaturesSchema = featureSchema({
	extPos: EnglishOtherExtPos, // https://universaldependencies.org/treebanks/en_ewt/en_ewt-pos-X.html
	foreign: UniversalFeature.Foreign,
});
