import { resolveMorphemeItems } from "../../../../common/morpheme-link-target";
import type { EntrySection } from "../../../../domain/dict-note/types";
import type { MorphemeItem } from "../../../../domain/morpheme/morpheme-formatter";
import { morphemeFormatterHelper } from "../../../../domain/morpheme/morpheme-formatter";
import { cssSuffixFor } from "../../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../targets/de/sections/section-kind";
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
