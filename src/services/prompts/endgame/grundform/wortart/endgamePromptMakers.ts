import { Wortart } from "../../zod/types";
import { makeEndgameAdjektivPrompt } from "./adjektiv/adjektivPrompt";
import { makeGrundformsPrompt } from "./grundforms/grundformsPrompt";
import { makeEndgameMorhpemsPrompt } from "./morphems/morphemsPrompt";

const a = Wortart.Adjektiv;

type PromtMakerFromWortart = Record<
	typeof a | "Morphems" | "Grundform",
	() => string
>;

export const promtMakerFromKeyword: PromtMakerFromWortart = {
	[Wortart.Adjektiv]: makeEndgameAdjektivPrompt,
	Grundform: makeGrundformsPrompt,
	Morphems: makeEndgameMorhpemsPrompt,
};
