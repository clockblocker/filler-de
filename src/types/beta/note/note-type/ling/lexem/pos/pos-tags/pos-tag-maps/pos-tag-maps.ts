import { PartOfSpeech, PARTS_OF_SPEECH } from '../../pos';
import {
	NOUN_TAG,
	PRONOUN_TAG,
	ARTICLE_TAG,
	ADJECTIVE_TAG,
	VERB_TAG,
	PREPOSITION_TAG,
	ADVERB_TAG,
	PARTICLE_TAG,
	CONJUNCTION_TAG,
	INTERACTIONAL_UNIT_TAG,
	PosTag,
} from '../pos-tag-consts';

export const posTagFormFromPos: Record<PartOfSpeech, PosTag> = {
	[PartOfSpeech.Noun]: NOUN_TAG,
	[PartOfSpeech.Pronoun]: PRONOUN_TAG,
	[PartOfSpeech.Article]: ARTICLE_TAG,
	[PartOfSpeech.Adjective]: ADJECTIVE_TAG,
	[PartOfSpeech.Verb]: VERB_TAG,
	[PartOfSpeech.Preposition]: PREPOSITION_TAG,
	[PartOfSpeech.Adverb]: ADVERB_TAG,
	[PartOfSpeech.Particle]: PARTICLE_TAG,
	[PartOfSpeech.Conjunction]: CONJUNCTION_TAG,
	[PartOfSpeech.InteractionalUnit]: INTERACTIONAL_UNIT_TAG,
} as const;

export const posFormFromPosTag: Record<PosTag, PartOfSpeech> = {
	[NOUN_TAG]: PartOfSpeech.Noun,
	[PRONOUN_TAG]: PartOfSpeech.Pronoun,
	[ARTICLE_TAG]: PartOfSpeech.Article,
	[ADJECTIVE_TAG]: PartOfSpeech.Adjective,
	[VERB_TAG]: PartOfSpeech.Verb,
	[PREPOSITION_TAG]: PartOfSpeech.Preposition,
	[ADVERB_TAG]: PartOfSpeech.Adverb,
	[PARTICLE_TAG]: PartOfSpeech.Particle,
	[CONJUNCTION_TAG]: PartOfSpeech.Conjunction,
	[INTERACTIONAL_UNIT_TAG]: PartOfSpeech.InteractionalUnit,
} as const;

export const POS_TAGS: PosTag[] = PARTS_OF_SPEECH.map(
	(pos) => posTagFormFromPos[pos]
);
