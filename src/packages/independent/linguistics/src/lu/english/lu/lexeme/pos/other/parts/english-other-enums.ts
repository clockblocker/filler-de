import { NumType } from "../../../../../../universal/enums/feature/ud/num-type";
import {
	EnglishCase,
	EnglishGender,
	EnglishMood,
	EnglishNumber,
	EnglishVerbForm,
} from "../../../shared/english-common-enums";

export const EnglishOtherCase = EnglishCase;
export const EnglishOtherGender = EnglishGender;
export const EnglishOtherMood = EnglishMood;
export const EnglishOtherNumber = EnglishNumber;
export const EnglishOtherVerbForm = EnglishVerbForm;

export const EnglishOtherNumType = NumType.extract(["Card", "Mult", "Range"]);
