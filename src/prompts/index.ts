import { generate_valence_block } from './valence';
import { generate_forms } from './generate-forms';
import { baseDict } from './baseDict';
import { morphems } from './morphems';
import { C1_RICHTER_PROMPT_V2 } from './c1Richter';
import { normalize } from 'path';
import { determine_infinitive_and_pick_emoji } from './determine-infinitive-and-pick-emoji';
import { keymaker } from './keymaker';
import { translate_de_to_eng } from './translate-de-to-eng';

export const prompts = {
	generate_dictionary_entry: baseDict,
	c1Richter: C1_RICHTER_PROMPT_V2,
	generate_forms,
	morphems,
	determine_infinitive_and_pick_emoji,
	normalize,
	translate_de_to_eng,
	keymaker,
	generate_valence_block,
};
