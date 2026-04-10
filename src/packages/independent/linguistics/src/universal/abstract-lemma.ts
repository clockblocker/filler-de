import type { Prettify } from "src/types/helpers";
import { IS_CLOSED_SET_KEY, type IsClosedSet } from "./enums/core/meta";
import type {
	DISCOURSE_FORMULA_ROLE_KEY,
	DiscourseFormulaRole,
} from "./enums/feature/custom/discourse-formula-role";
import type { AbstractFeatures } from "./enums/feature/feature";
import type {
	MORPHEME_KIND_KEY,
	MorphemeKind,
} from "./enums/kind/morpheme-kind";
import type {
	PHRASEME_KIND_KEY,
	PhrasemeKind,
} from "./enums/kind/phraseme-kind";

export type AbstractLexeme = Prettify<{
	[MORPHEME_KIND_KEY]?: MorphemeKind;
	inherentFeatures?: Partial<AbstractFeatures>;
	[IS_CLOSED_SET_KEY]?: IsClosedSet;
}>;

export type AbstractMorphem = Prettify<{
	[MORPHEME_KIND_KEY]?: MorphemeKind;
	[IS_CLOSED_SET_KEY]?: IsClosedSet;
}>;

export type AbstractPhrasem = Prettify<
	{
		[PHRASEME_KIND_KEY]?: PhrasemeKind;
	} & (
		| {
				[PHRASEME_KIND_KEY]?:
					| typeof PhrasemeKind.enum.Aphorism
					| typeof PhrasemeKind.enum.Cliché;
		  }
		| {
				[PHRASEME_KIND_KEY]?: typeof PhrasemeKind.enum.DiscourseFormula;
				[DISCOURSE_FORMULA_ROLE_KEY]?: DiscourseFormulaRole;
		  }
	)
>;
