import { makeEndgameAdjektivPrompt } from './adjektiv/adjektivPrompt';
import { makeEndgameMorhpemsPrompt } from './morphems/morphemsPrompt';
import { makeGrundformsPrompt } from './grundforms/grundformsPrompt';
import { Wortart } from 'prompts/endgame/zod/types';

const a = Wortart.Adjektiv;

type PromtMakerFromWortart = Record<
	typeof a | 'Morphems' | 'Grundform',
	() => string
>;

export const promtMakerFromKeyword: PromtMakerFromWortart = {
	[Wortart.Adjektiv]: makeEndgameAdjektivPrompt,
	Morphems: makeEndgameMorhpemsPrompt,
	Grundform: makeGrundformsPrompt,
};
