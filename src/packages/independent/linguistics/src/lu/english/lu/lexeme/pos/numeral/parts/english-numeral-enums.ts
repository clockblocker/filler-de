import { UniversalFeature } from "../../../../../../universal/enums/feature";
import {
	EnglishCase,
	EnglishGender,
	EnglishNumber,
} from "../../../shared/english-common-enums";

export const EnglishNumeralCase = EnglishCase;
export const EnglishNumeralGender = EnglishGender;
export const EnglishNumeralNumber = EnglishNumber;

export const EnglishNumeralNumType = UniversalFeature.NumType.extract([
	"Card",
	"Frac",
	"Mult",
	"Range",
]);
