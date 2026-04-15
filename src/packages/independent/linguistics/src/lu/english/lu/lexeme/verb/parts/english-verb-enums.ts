import { Mood } from "../../../../../universal/enums/feature/ud/mood";
import { GrammaticalNumber } from "../../../../../universal/enums/feature/ud/number";
import { Person } from "../../../../../universal/enums/feature/ud/person";
import { Tense } from "../../../../../universal/enums/feature/ud/tense";
import { VerbForm } from "../../../../../universal/enums/feature/ud/verb-form";

export const EnglishVerbMood = Mood.extract(["Imp", "Ind", "Sub"]);

export const EnglishVerbNumber = GrammaticalNumber.extract(["Plur", "Sing"]);

export const EnglishVerbPerson = Person.extract(["1", "2", "3"]);

export const EnglishVerbTense = Tense.extract(["Past", "Pres"]);

export const EnglishVerbVerbForm = VerbForm.extract(["Fin", "Inf", "Part"]);
