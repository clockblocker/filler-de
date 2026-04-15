import { Case } from "../../../../../universal/enums/feature/ud/case";
import { GrammaticalNumber } from "../../../../../universal/enums/feature/ud/number";

export const EnglishNounCase = Case.extract(["Gen"]);

export const EnglishNounNumber = GrammaticalNumber.extract(["Plur", "Sing"]);
