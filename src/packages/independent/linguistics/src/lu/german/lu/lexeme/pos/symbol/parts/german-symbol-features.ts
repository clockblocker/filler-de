import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import {
	GermanCase,
	GermanGender,
	GermanNumber,
} from "../../../shared/german-common-enums";
import { GermanSymbolNumType } from "./german-symbol-enums";

export const GermanSymbolInflectionalFeaturesSchema = featureSchema({
	case: GermanCase.optional(),
	gender: GermanGender.optional(),
	number: GermanNumber.optional(),
});

export const GermanSymbolInherentFeaturesSchema = featureSchema({
	foreign: UniversalFeature.Foreign.optional(),
	numType: GermanSymbolNumType.optional(),
});
