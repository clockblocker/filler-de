import { UniversalFeature } from "../../../../../../universal/enums/feature";
import {
	GermanCase,
	GermanGender,
	GermanNumber,
} from "../../../shared/german-common-enums";

export const GermanNumeralCase = GermanCase;
export const GermanNumeralGender = GermanGender;
export const GermanNumeralNumber = GermanNumber;

export const GermanNumeralNumType = UniversalFeature.NumType.extract([
	"Card",
	"Frac",
	"Mult",
	"Range",
]);
