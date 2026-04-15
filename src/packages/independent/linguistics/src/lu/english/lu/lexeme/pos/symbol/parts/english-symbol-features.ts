import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	EnglishCase,
	EnglishGender,
	EnglishNumber,
} from "../../../shared/english-common-enums";
import { EnglishSymbolNumType } from "./english-symbol-enums";

export const EnglishSymbolInflectionalFeaturesSchema = featureSchema({
	case: EnglishCase.optional(),
	gender: EnglishGender.optional(),
	number: EnglishNumber.optional(),
});

export const EnglishSymbolInherentFeaturesSchema = featureSchema({
	foreign: UniversalFeature.Foreign.optional(),
	numType: EnglishSymbolNumType.optional(),
});
