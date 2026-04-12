import type { LexicalInfo } from "@textfresser/lexical-generation";
import type { EntrySection } from "../../../../domain/dict-note/types";
import {
	getLexicalInfoInherentFeatures,
	getLexicalInfoPos,
	isLexicalInfoLexeme,
} from "../../../../domain/lexical-info-view";
import { cssSuffixFor } from "../../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../targets/de/sections/section-kind";
import { buildFeatureTagPath } from "../features-prompt-dispatch";
import { buildInherentFeatureTags } from "../inherent-feature-tags";
import type { GenerationTargetLanguage } from "../section-generation-types";

export type TagsSectionContext = {
	lexicalInfo: LexicalInfo;
	targetLang: GenerationTargetLanguage;
};

export function generateTagsSection(
	ctx: TagsSectionContext,
): EntrySection | null {
	if (!isLexicalInfoLexeme(ctx.lexicalInfo)) return null;

	const pos = getLexicalInfoPos(ctx.lexicalInfo);
	const inherentFeatures = getLexicalInfoInherentFeatures(ctx.lexicalInfo);
	if (!pos || !inherentFeatures) return null;

	const tags = buildInherentFeatureTags(inherentFeatures);
	if (tags.length === 0) return null;

	return {
		content: buildFeatureTagPath(pos, tags),
		kind: cssSuffixFor[DictSectionKind.Tags],
		title: TitleReprFor[DictSectionKind.Tags][ctx.targetLang],
	};
}
