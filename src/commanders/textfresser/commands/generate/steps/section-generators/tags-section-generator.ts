import { cssSuffixFor } from "../../../../../../linguistics/common/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../../../linguistics/common/sections/section-kind";
import type { EntrySection } from "../../../../../../stateless-helpers/dict-note/types";
import type { LemmaResult } from "../../../lemma/types";
import { buildFeatureTagPath } from "../features-prompt-dispatch";
import type {
	FeaturesOutput,
	GenerationTargetLanguage,
} from "../section-generation-types";
import { buildVerbFeatureTags, isVerbFeaturesOutput } from "../verb-features";

export type TagsSectionContext = {
	featuresOutput: FeaturesOutput | null;
	lemmaResult: LemmaResult;
	targetLang: GenerationTargetLanguage;
};

export function generateTagsSection(
	ctx: TagsSectionContext,
): EntrySection | null {
	if (!ctx.featuresOutput) return null;
	if (ctx.lemmaResult.linguisticUnit !== "Lexem") return null;

	const tags = isVerbFeaturesOutput(ctx.featuresOutput)
		? buildVerbFeatureTags(ctx.featuresOutput)
		: ctx.featuresOutput.tags;

	return {
		content: buildFeatureTagPath(ctx.lemmaResult.posLikeKind, tags),
		kind: cssSuffixFor[DictSectionKind.Tags],
		title: TitleReprFor[DictSectionKind.Tags][ctx.targetLang],
	};
}
