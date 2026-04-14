import type { Prettify } from "../../../../../../types/helpers";
import type { TargetLanguage } from "./enums/core/language";
import type { IsClosedSet } from "./enums/core/meta";
import type { LemmaKind } from "./enums/core/selection";
import type { DiscourseFormulaRole } from "./enums/feature/custom/discourse-formula-role";
import type { IsSeparable } from "./enums/feature/custom/separable";
import type { AbstractFeatures } from "./enums/feature/feature";
import type { MorphemeKind } from "./enums/kind/morpheme-kind";
import type {
	PHRASEME_KIND_KEY,
	PhrasemeKind,
} from "./enums/kind/phraseme-kind";
import type { Pos } from "./enums/kind/pos";
import type { LemmaDiscriminatorFor } from "./lemma-discriminator";

type AbstractLexemeLemma<P extends Pos = Pos> = Prettify<{
	meaningInEmojis?: string;
	lemmaKind: "Lexeme";
	language: TargetLanguage;
	pos: P;
	inherentFeatures: Partial<AbstractFeatures>;
	isClosedSet?: IsClosedSet;
	spelledLemma: string;
}>;

type AbstractMorphemLemma<MK extends MorphemeKind = MorphemeKind> = Prettify<{
	meaningInEmojis?: string;
	lemmaKind: "Morpheme";
	language: TargetLanguage;
	morphemeKind: MK;
	isClosedSet?: IsClosedSet;
	separable?: IsSeparable;
	spelledLemma: string;
}>;

type AbstractPhrasemLemma<PK extends PhrasemeKind = PhrasemeKind> = Prettify<
	{
		meaningInEmojis?: string;
		lemmaKind: "Phraseme";
		language: TargetLanguage;
		[PHRASEME_KIND_KEY]: PK;
		spelledLemma: string;
	} & (
		| {
				[PHRASEME_KIND_KEY]:
					| Extract<PK, typeof PhrasemeKind.enum.Aphorism>
					| Extract<PK, typeof PhrasemeKind.enum.Cliché>
					| Extract<PK, typeof PhrasemeKind.enum.Idiom>
					| Extract<PK, typeof PhrasemeKind.enum.Proverb>;
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
> = LK extends "Lexeme"
	? AbstractLexemeLemma<Extract<D, Pos>>
	: LK extends "Morpheme"
		? AbstractMorphemLemma<Extract<D, MorphemeKind>>
		: LK extends "Phraseme"
			? AbstractPhrasemLemma<Extract<D, PhrasemeKind>>
			: never;
