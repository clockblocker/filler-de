import { UniversalFeature } from "../../../../../../universal/enums/feature";
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

export const EnglishOtherNumType = UniversalFeature.NumType.extract([
	"Card",
	"Mult",
	"Range",
]);
