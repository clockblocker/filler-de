import { cssSuffixFor } from "../../../../../../linguistics/common/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../../../linguistics/common/sections/section-kind";
import type { EntrySection } from "../../../../../../stateless-helpers/dict-note/types";
import type { MorphemeItem } from "../../../../../../stateless-helpers/morpheme-formatter";
import { morphemeFormatterHelper } from "../../../../../../stateless-helpers/morpheme-formatter";
import { resolveMorphemeItems } from "../../../../common/morpheme-link-target";
import type {
	GenerationTargetLanguage,
	MorphemOutput,
} from "../section-generation-types";

export type MorphemSectionContext = {
	output: MorphemOutput;
	targetLang: GenerationTargetLanguage;
};

export type MorphemSectionResult = {
	morphemes: MorphemeItem[];
	section: EntrySection;
};

export function generateMorphemSection(
	ctx: MorphemSectionContext,
): MorphemSectionResult {
	const morphemes = resolveMorphemeItems(
		ctx.output.morphemes,
		ctx.targetLang,
	);

	return {
		morphemes,
		section: {
			content: morphemeFormatterHelper.formatSection(
				morphemes,
				ctx.targetLang,
			),
			kind: cssSuffixFor[DictSectionKind.Morphem],
			title: TitleReprFor[DictSectionKind.Morphem][ctx.targetLang],
		},
	};
}
