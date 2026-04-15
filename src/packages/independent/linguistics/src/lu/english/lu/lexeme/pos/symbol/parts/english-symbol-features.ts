import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { EnglishFeature } from "../../../shared/english-common-enums";
import { EnglishSymbolNumType } from "./english-symbol-enums";

export const EnglishSymbolInflectionalFeaturesSchema = featureSchema({
	case: EnglishFeature.Case.optional(),
	gender: EnglishFeature.Gender.optional(),
	number: EnglishFeature.Number.optional(),
});

export const EnglishSymbolInherentFeaturesSchema = featureSchema({
	foreign: UniversalFeature.Foreign.optional(),
	numType: EnglishSymbolNumType.optional(),
});
