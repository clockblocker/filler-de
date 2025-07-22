import z from 'zod/v4';
import {
	ADJECTIVE_TAG,
	NOUN_TAG,
	VERB_TAG,
	ADVERB_TAG,
	PREPOSITION_TAG,
} from '../../../lexem/pos/pos-tags/pos-tag-consts';
import { PLUS_DELIMETER } from 'types/beta/consts/format';

const COLLOCATION_TYPES_STR = [
	`${ADJECTIVE_TAG}${PLUS_DELIMETER}${NOUN_TAG}`, // ADJ_plus_NOUN e.g. "strong tea", "deep sleep"
	`${NOUN_TAG}${PLUS_DELIMETER}${NOUN_TAG}`, // NOUN_plus_NOUN e.g. "chicken soup", "data center"
	`${NOUN_TAG}${PLUS_DELIMETER}${VERB_TAG}`, // NOUN_plus_VERB e.g. "dogs bark", "alarms ring"
	`${VERB_TAG}${PLUS_DELIMETER}${NOUN_TAG}`, // VERB_plus_NOUN e.g. "make a decision", "catch a cold"
	`${ADVERB_TAG}${PLUS_DELIMETER}${ADJECTIVE_TAG}`, // ADV_plus_ADJ e.g. "deeply sorry", "highly unlikely"
	`${VERB_TAG}${PLUS_DELIMETER}${PREPOSITION_TAG}`, // VERB_plus_PREP (Verb plus PREPositional phrase) e.g. "depend on", "look into"
	`${VERB_TAG}${PLUS_DELIMETER}${ADVERB_TAG}`, // VERB_plus_ADV e.g. "speak loudly", "run fast"
] as const;

export const CollocationTypeSchema = z.enum(COLLOCATION_TYPES_STR);

export type CollocationType = z.infer<typeof CollocationTypeSchema>;
export const CollocationType = CollocationTypeSchema.enum;
export const COLLOCATION_TYPES = CollocationTypeSchema.options;
