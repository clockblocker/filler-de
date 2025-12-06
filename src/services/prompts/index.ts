import { normalize } from "path";
import { baseDict } from "./baseDict";
import { C1_RICHTER_PROMPT } from "./c1Richter";
import { determine_infinitive_and_pick_emoji } from "./determine-infinitive-and-pick-emoji";
import { generate_forms } from "./generate-forms";
import { keymaker } from "./keymaker";
import { morphems } from "./morphems";
import { translate_de_to_eng } from "./translate-de-to-eng";
import { generate_valence_block } from "./valence";

export const prompts = {
	c1Richter: C1_RICHTER_PROMPT,
	determine_infinitive_and_pick_emoji,
	generate_dictionary_entry: baseDict,
	generate_forms,
	generate_valence_block,
	keymaker,
	morphems,
	normalize,
	translate_de_to_eng,
};
