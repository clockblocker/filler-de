import { Case } from "../../../../universal/enums/feature/ud/case";
import { Definite } from "../../../../universal/enums/feature/ud/definite";
import { Degree } from "../../../../universal/enums/feature/ud/degree";
import { Gender } from "../../../../universal/enums/feature/ud/gender";
import { Mood } from "../../../../universal/enums/feature/ud/mood";
import { GrammaticalNumber } from "../../../../universal/enums/feature/ud/number";
import { Person } from "../../../../universal/enums/feature/ud/person";
import { Polarity } from "../../../../universal/enums/feature/ud/polarity";
import { Tense } from "../../../../universal/enums/feature/ud/tense";
import { VerbForm } from "../../../../universal/enums/feature/ud/verb-form";

export const EnglishCase = Case.extract(["Acc", "Gen", "Nom"]);

export const EnglishDefinite = Definite.extract(["Def", "Ind"]);

export const EnglishDegree = Degree.extract(["Cmp", "Pos", "Sup"]);

export const EnglishGender = Gender.extract(["Fem", "Masc", "Neut"]);

export const EnglishMood = Mood.extract(["Imp", "Ind", "Sub"]);

export const EnglishNumber = GrammaticalNumber.extract(["Plur", "Sing"]);

export const EnglishPerson = Person.extract(["1", "2", "3"]);

export const EnglishPolarity = Polarity.extract(["Neg", "Pos"]);

export const EnglishTense = Tense.extract(["Past", "Pres"]);

export const EnglishVerbForm = VerbForm.extract(["Fin", "Inf", "Part"]);
