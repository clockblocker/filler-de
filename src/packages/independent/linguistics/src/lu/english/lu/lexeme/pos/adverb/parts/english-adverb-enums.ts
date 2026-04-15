import { NumType } from "../../../../../../universal/enums/feature/ud/num-type";
import { PronType } from "../../../../../../universal/enums/feature/ud/pron-type";
import { EnglishDegree } from "../../../shared/english-common-enums";

export const EnglishAdverbDegree = EnglishDegree;

export const EnglishAdverbNumType = NumType.extract(["Card", "Mult"]);

export const EnglishAdverbPronType = PronType.extract(["Dem", "Int", "Rel"]);
