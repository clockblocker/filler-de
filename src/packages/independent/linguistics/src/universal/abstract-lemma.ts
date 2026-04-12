import type { Prettify } from "../../../../../types/helpers";
import type { IsClosedSet } from "./enums/core/meta";
import type { LemmaKind } from "./enums/core/selection";
import type { DiscourseFormulaRole } from "./enums/feature/custom/discourse-formula-role";
import type { AbstractFeatures } from "./enums/feature/feature";
import type { MorphemeKind } from "./enums/kind/morpheme-kind";
import type {
	PHRASEME_KIND_KEY,
	PhrasemeKind,
} from "./enums/kind/phraseme-kind";
import type { Pos } from "./enums/kind/pos";

type AbstractLexemeLemma = Prettify<{
	pos: Pos;
	inherentFeatures: Partial<AbstractFeatures>;
	isClosedSet?: IsClosedSet;
}>;

type AbstractMorphemLemma = Prettify<{
	morphemeKind: MorphemeKind;
	isClosedSet?: IsClosedSet;
}>;

type AbstractPhrasemLemma = Prettify<
	{
		[PHRASEME_KIND_KEY]: PhrasemeKind;
	} & (
		| {
				[PHRASEME_KIND_KEY]:
					| typeof PhrasemeKind.enum.Aphorism
					| typeof PhrasemeKind.enum.Cliché;
		  }
		| {
				[PHRASEME_KIND_KEY]: typeof PhrasemeKind.enum.DiscourseFormula;
				discourseFormulaRole?: DiscourseFormulaRole;
		  }
	)
>;

export type AbstractLemma<LK extends LemmaKind = LemmaKind> =
	LK extends "Lexeme"
		? AbstractLexemeLemma
		: LK extends "Morpheme"
			? AbstractMorphemLemma
			: LK extends "Phraseme"
				? AbstractPhrasemLemma
				: never;
