import { UniversalFeature } from "../../../../../../universal/enums/feature";
import {
	GermanCase,
	GermanGender,
	GermanNumber,
} from "../../../shared/german-common-enums";

export const GermanSymbolCase = GermanCase;
export const GermanSymbolGender = GermanGender;
export const GermanSymbolNumber = GermanNumber;

export const GermanSymbolNumType = UniversalFeature.NumType.extract([
	"Card",
	"Range",
]);
