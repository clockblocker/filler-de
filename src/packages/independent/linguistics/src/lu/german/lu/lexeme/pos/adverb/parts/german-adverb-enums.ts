import { NumType } from "../../../../../../universal/enums/feature/ud/num-type";
import { PronType } from "../../../../../../universal/enums/feature/ud/pron-type";
import { GermanDegree } from "../../../shared/german-common-enums";

export const GermanAdverbDegree = GermanDegree;

export const GermanAdverbNumType = NumType.extract(["Card", "Mult"]);

export const GermanAdverbPronType = PronType.extract(["Dem", "Int", "Rel"]);
