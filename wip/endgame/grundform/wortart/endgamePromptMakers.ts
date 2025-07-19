import { Wortart } from 'prompts/wip/endgame/zod/types';
import { makeEndgameAdjektivPrompt } from './adjektiv/adjektivPrompt';
import { makeEndgameMorhpemsPrompt } from './morphems/morphemsPrompt';
import { makeGrundformsPrompt } from './grundforms/grundformsPrompt';

const a = Wortart.Adjektiv;
// type PromtMakerFromWortart = Record<Wortart | "Morphems" | "Grundform", string>;
type PromtMakerFromWortart = Record<
	typeof a | 'Morphems' | 'Grundform',
	() => string
>;

export const promtMakerFromKeyword: PromtMakerFromWortart = {
	[Wortart.Adjektiv]: makeEndgameAdjektivPrompt,
	Morphems: makeEndgameMorhpemsPrompt,
	Grundform: makeGrundformsPrompt,
};
