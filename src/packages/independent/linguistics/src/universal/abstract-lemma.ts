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
import type {
	AbstractLexicalRelations,
	AbstractMorphologicalRelations,
} from "./enums/relation/relation";
import type { LemmaDiscriminatorFor } from "./lemma-discriminator";

type AbstractLexemeLemma<P extends Pos = Pos> = Prettify<{
	pos: P;
	inherentFeatures: Partial<AbstractFeatures>;
	lexicalRelations: AbstractLexicalRelations;
	morphologicalRelations: AbstractMorphologicalRelations;
	isClosedSet?: IsClosedSet;
}>;

type AbstractMorphemLemma<MK extends MorphemeKind = MorphemeKind> = Prettify<{
	morphemeKind: MK;
	lexicalRelations: AbstractLexicalRelations;
	isClosedSet?: IsClosedSet;
}>;

type AbstractPhrasemLemma<PK extends PhrasemeKind = PhrasemeKind> = Prettify<
	{
		lexicalRelations: AbstractLexicalRelations;
		[PHRASEME_KIND_KEY]: PK;
	} & (
		| {
				[PHRASEME_KIND_KEY]:
					| Extract<PK, typeof PhrasemeKind.enum.Aphorism>
					| Extract<PK, typeof PhrasemeKind.enum.Cliché>;
		  }
		| {
				[PHRASEME_KIND_KEY]: Extract<
					PK,
					typeof PhrasemeKind.enum.DiscourseFormula
				>;
				discourseFormulaRole?: DiscourseFormulaRole;
		  }
	)
>;

export type AbstractLemma<
	LK extends LemmaKind = LemmaKind,
	D extends LemmaDiscriminatorFor<LK> = LemmaDiscriminatorFor<LK>,
> =
	LK extends "Lexeme"
		? AbstractLexemeLemma<Extract<D, Pos>>
		: LK extends "Morpheme"
			? AbstractMorphemLemma<Extract<D, MorphemeKind>>
			: LK extends "Phraseme"
				? AbstractPhrasemLemma<Extract<D, PhrasemeKind>>
				: never;
