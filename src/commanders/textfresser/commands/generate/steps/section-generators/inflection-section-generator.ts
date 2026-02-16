import type { NounInflectionCell } from "../../../../../../linguistics/de/lexem/noun";
import type { EntrySection } from "../../../../domain/dict-note/types";
import { cssSuffixFor } from "../../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../targets/de/sections/section-kind";
import type { LemmaResult } from "../../../lemma/types";
import { formatInflectionSection } from "../../section-formatters/common/inflection-formatter";
import { formatInflection } from "../../section-formatters/de/lexem/noun/inflection-formatter";
import type {
	GenerationTargetLanguage,
	InflectionOutput,
	NounInflectionOutput,
} from "../section-generation-types";

export type InflectionSectionContext = {
	lemmaResult: LemmaResult;
	nounInflectionOutput: NounInflectionOutput | null;
	otherInflectionOutput: InflectionOutput | null;
	targetLang: GenerationTargetLanguage;
};

export type InflectionSectionResult = {
	inflectionCells: NounInflectionCell[];
	section: EntrySection | null;
};

export function generateInflectionSection(
	ctx: InflectionSectionContext,
): InflectionSectionResult {
	let content: string | undefined;
	let inflectionCells: NounInflectionCell[] = [];

	if (
		ctx.lemmaResult.linguisticUnit === "Lexem" &&
		ctx.lemmaResult.posLikeKind === "Noun" &&
		ctx.nounInflectionOutput
	) {
		const result = formatInflection(ctx.nounInflectionOutput);
		content = result.formattedSection;
		inflectionCells = result.cells;
	} else if (
		ctx.lemmaResult.linguisticUnit === "Lexem" &&
		ctx.lemmaResult.posLikeKind !== "Noun" &&
		ctx.otherInflectionOutput
	) {
		content = formatInflectionSection(ctx.otherInflectionOutput);
	}

	if (!content) {
		return { inflectionCells, section: null };
	}

	return {
		inflectionCells,
		section: {
			content,
			kind: cssSuffixFor[DictSectionKind.Inflection],
			title: TitleReprFor[DictSectionKind.Inflection][ctx.targetLang],
		},
	};
}
