import {
	PartOfSpeech,
	PosTag,
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
} from '../consts/linguistics-consts';

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
