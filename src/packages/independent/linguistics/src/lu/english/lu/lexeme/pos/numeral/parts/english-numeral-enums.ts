import { NumType } from "../../../../../../universal/enums/feature/ud/num-type";
import {
	EnglishCase,
	EnglishGender,
	EnglishNumber,
} from "../../../shared/english-common-enums";

export const EnglishNumeralCase = EnglishCase;
export const EnglishNumeralGender = EnglishGender;
export const EnglishNumeralNumber = EnglishNumber;

export const EnglishNumeralNumType = NumType.extract([
	"Card",
	"Frac",
	"Mult",
	"Range",
]);
