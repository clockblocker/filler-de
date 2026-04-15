import { UniversalFeature } from "../../../../../../universal/enums/feature";
import {
	EnglishCase,
	EnglishGender,
	EnglishNumber,
} from "../../../shared/english-common-enums";

export const EnglishSymbolCase = EnglishCase;
export const EnglishSymbolGender = EnglishGender;
export const EnglishSymbolNumber = EnglishNumber;

export const EnglishSymbolNumType = UniversalFeature.NumType.extract([
	"Card",
	"Range",
]);
