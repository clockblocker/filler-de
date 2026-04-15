/** biome-ignore-all lint/correctness/noUnusedVariables: Demo */
import type { Lemma, Selection } from "../index";

type Test = Selection<"English", "Standard", "Inflection", "Lexeme", "ADJ">;
//
type Test1 = Lemma<"German", "Lexeme", "NOUN">; // Pass auf dich auf
//
//
