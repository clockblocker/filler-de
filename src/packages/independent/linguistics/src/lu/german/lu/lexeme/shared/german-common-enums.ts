import { Case } from "../../../../universal/enums/feature/ud/case";
import { Definite } from "../../../../universal/enums/feature/ud/definite";
import { Degree } from "../../../../universal/enums/feature/ud/degree";
import { Gender } from "../../../../universal/enums/feature/ud/gender";
import { Mood } from "../../../../universal/enums/feature/ud/mood";
import { GrammaticalNumber } from "../../../../universal/enums/feature/ud/number";
import { Person } from "../../../../universal/enums/feature/ud/person";
import { Polarity } from "../../../../universal/enums/feature/ud/polarity";
import { Polite } from "../../../../universal/enums/feature/ud/polite";
import { Tense } from "../../../../universal/enums/feature/ud/tense";
import { VerbForm } from "../../../../universal/enums/feature/ud/verb-form";

export const GermanCase = Case.extract(["Acc", "Dat", "Gen", "Nom"]);

export const GermanDefinite = Definite.extract(["Def", "Ind"]);

export const GermanDegree = Degree.extract(["Cmp", "Pos", "Sup"]);

export const GermanGender = Gender.extract(["Fem", "Masc", "Neut"]);

export const GermanMood = Mood.extract(["Imp", "Ind", "Sub"]);

export const GermanNumber = GrammaticalNumber.extract(["Plur", "Sing"]);

export const GermanPerson = Person.extract(["1", "2", "3"]);

export const GermanPolarity = Polarity.extract(["Neg", "Pos"]);

export const GermanPolite = Polite.extract(["Form"]);

export const GermanTense = Tense.extract(["Past", "Pres"]);

export const GermanVerbForm = VerbForm.extract(["Fin", "Inf", "Part"]);
