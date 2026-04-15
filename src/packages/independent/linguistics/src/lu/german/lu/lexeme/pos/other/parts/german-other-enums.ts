import { UniversalFeature } from "../../../../../../universal/enums/feature";
import {
	GermanCase,
	GermanGender,
	GermanMood,
	GermanNumber,
	GermanVerbForm,
} from "../../../shared/german-common-enums";

export const GermanOtherCase = GermanCase;
export const GermanOtherGender = GermanGender;
export const GermanOtherMood = GermanMood;
export const GermanOtherNumber = GermanNumber;
export const GermanOtherVerbForm = GermanVerbForm;

export const GermanOtherNumType = UniversalFeature.NumType.extract([
	"Card",
	"Mult",
	"Range",
]);
