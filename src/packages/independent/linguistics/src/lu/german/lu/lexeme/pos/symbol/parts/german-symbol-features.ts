import { UniversalFeature } from "../../../../../../universal/enums/feature";
import { featureSchema } from "../../../../../../universal/helpers/schema-targets";
import { GermanFeature } from "../../../shared/german-common-enums";
import { GermanSymbolNumType } from "./german-symbol-enums";

export const GermanSymbolInflectionalFeaturesSchema = featureSchema({
	case: GermanFeature.Case.optional(),
	gender: GermanFeature.Gender.optional(),
	number: GermanFeature.Number.optional(),
});

export const GermanSymbolInherentFeaturesSchema = featureSchema({
	foreign: UniversalFeature.Foreign.optional(),
	numType: GermanSymbolNumType.optional(),
});
