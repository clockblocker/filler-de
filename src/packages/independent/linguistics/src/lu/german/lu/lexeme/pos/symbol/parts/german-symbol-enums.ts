import { NumType } from "../../../../../../universal/enums/feature/ud/num-type";
import {
	GermanCase,
	GermanGender,
	GermanNumber,
} from "../../../shared/german-common-enums";

export const GermanSymbolCase = GermanCase;
export const GermanSymbolGender = GermanGender;
export const GermanSymbolNumber = GermanNumber;

export const GermanSymbolNumType = NumType.extract(["Card", "Range"]);
