import { Case } from "../../../../../../universal/enums/feature/ud/case";
import { Gender } from "../../../../../../universal/enums/feature/ud/gender";
import { GrammaticalNumber } from "../../../../../../universal/enums/feature/ud/number";

export const GermanNounCase = Case.extract(["Acc", "Dat", "Gen", "Nom"]);

export const GermanNounGender = Gender.extract(["Fem", "Masc", "Neut"]);

export const GermanNounNumber = GrammaticalNumber.extract(["Plur", "Sing"]);
