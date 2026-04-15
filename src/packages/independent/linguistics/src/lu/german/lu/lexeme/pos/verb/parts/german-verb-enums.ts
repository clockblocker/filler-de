import { Gender } from "../../../../../../universal/enums/feature/ud/gender";
import { Mood } from "../../../../../../universal/enums/feature/ud/mood";
import { GrammaticalNumber } from "../../../../../../universal/enums/feature/ud/number";
import { Person } from "../../../../../../universal/enums/feature/ud/person";
import { Tense } from "../../../../../../universal/enums/feature/ud/tense";
import { VerbForm } from "../../../../../../universal/enums/feature/ud/verb-form";

export const GermanVerbGender = Gender.extract(["Fem", "Masc", "Neut"]);

export const GermanVerbMood = Mood.extract(["Imp", "Ind", "Sub"]);

export const GermanVerbNumber = GrammaticalNumber.extract(["Plur", "Sing"]);

export const GermanVerbPerson = Person.extract(["1", "2", "3"]);

export const GermanVerbTense = Tense.extract(["Past", "Pres"]);

export const GermanVerbVerbForm = VerbForm.extract(["Fin", "Inf", "Part"]);
