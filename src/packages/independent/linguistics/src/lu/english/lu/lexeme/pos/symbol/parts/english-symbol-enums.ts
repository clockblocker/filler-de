import { NumType } from "../../../../../../universal/enums/feature/ud/num-type";
import {
	EnglishCase,
	EnglishGender,
	EnglishNumber,
} from "../../../shared/english-common-enums";

export const EnglishSymbolCase = EnglishCase;
export const EnglishSymbolGender = EnglishGender;
export const EnglishSymbolNumber = EnglishNumber;

export const EnglishSymbolNumType = NumType.extract(["Card", "Range"]);
