import { NumType } from "../../../../../universal/enums/feature/ud/num-type";
import {
	GermanCase,
	GermanGender,
	GermanNumber,
} from "../../shared/german-common-enums";

export const GermanNumeralCase = GermanCase;
export const GermanNumeralGender = GermanGender;
export const GermanNumeralNumber = GermanNumber;

export const GermanNumeralNumType = NumType.extract([
	"Card",
	"Frac",
	"Mult",
	"Range",
]);
