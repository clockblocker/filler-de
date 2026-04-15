import { NumType } from "../../../../../universal/enums/feature/ud/num-type";
import {
	GermanCase,
	GermanDegree,
	GermanGender,
	GermanNumber,
} from "../../shared/german-common-enums";

export const GermanAdjectiveCase = GermanCase;
export const GermanAdjectiveDegree = GermanDegree;
export const GermanAdjectiveGender = GermanGender;
export const GermanAdjectiveNumber = GermanNumber;

export const GermanAdjectiveNumType = NumType.extract(["Card", "Ord"]);
