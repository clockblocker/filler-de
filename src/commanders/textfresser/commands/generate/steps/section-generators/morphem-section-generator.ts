import type { LexicalInfo } from "../../../../../../lexical-generation";
import { resolveMorphemeItems } from "../../../../common/morpheme-link-target";
import type { EntrySection } from "../../../../domain/dict-note/types";
import type { MorphemeItem } from "../../../../domain/morpheme/morpheme-formatter";
import { morphemeFormatterHelper } from "../../../../domain/morpheme/morpheme-formatter";
import { cssSuffixFor } from "../../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../targets/de/sections/section-kind";
import type { GenerationTargetLanguage } from "../section-generation-types";

export type MorphemSectionContext = {
	lexicalInfo: LexicalInfo;
	targetLang: GenerationTargetLanguage;
};

export type MorphemSectionResult = {
	morphemes: MorphemeItem[];
	section: EntrySection;
};

export function generateMorphemSection(
	ctx: MorphemSectionContext,
): MorphemSectionResult | null {
	if (ctx.lexicalInfo.morphemicBreakdown.status !== "ready") {
		return null;
	}

	const morphemes = resolveMorphemeItems(
		ctx.lexicalInfo.morphemicBreakdown.value.morphemes,
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
