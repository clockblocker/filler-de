import type { EntrySection } from "../../../../domain/dict-note/types";
import { cssSuffixFor } from "../../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../targets/de/sections/section-kind";
import type {
	GenerationTargetLanguage,
	WordTranslationOutput,
} from "../section-generation-types";

export type TranslationSectionContext = {
	output: WordTranslationOutput;
	targetLang: GenerationTargetLanguage;
};

export function generateTranslationSection(
	ctx: TranslationSectionContext,
): EntrySection | null {
	if (!ctx.output) return null;

	return {
		content: ctx.output,
		kind: cssSuffixFor[DictSectionKind.Translation],
		title: TitleReprFor[DictSectionKind.Translation][ctx.targetLang],
	};
}
