import type { LexicalInfo } from "../../../../../../lexical-generation";
import type { EntrySection } from "../../../../domain/dict-note/types";
import { cssSuffixFor } from "../../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../targets/de/sections/section-kind";
import {
	buildAdjectiveFeatureTags,
} from "../adjective-features";
import { buildFeatureTagPath } from "../features-prompt-dispatch";
import type { GenerationTargetLanguage } from "../section-generation-types";
import { buildVerbFeatureTags } from "../verb-features";

export type TagsSectionContext = {
	lexicalInfo: LexicalInfo;
	targetLang: GenerationTargetLanguage;
};

export function generateTagsSection(
	ctx: TagsSectionContext,
): EntrySection | null {
	if (ctx.lexicalInfo.lemma.linguisticUnit !== "Lexem") return null;
	if (ctx.lexicalInfo.features.status !== "ready") return null;

	let tags: string[];

	if (ctx.lexicalInfo.features.value.kind === "verb") {
		tags = buildVerbFeatureTags(ctx.lexicalInfo.features.value);
	} else if (ctx.lexicalInfo.features.value.kind === "adjective") {
		tags = buildAdjectiveFeatureTags(ctx.lexicalInfo.features.value);
	} else if (
		ctx.lexicalInfo.features.value.kind === "noun" ||
		ctx.lexicalInfo.features.value.kind === "tags"
	) {
		tags = ctx.lexicalInfo.features.value.tags;
	} else {
		return null;
	}

	return {
		content: buildFeatureTagPath(ctx.lexicalInfo.lemma.posLikeKind, tags),
		kind: cssSuffixFor[DictSectionKind.Tags],
		title: TitleReprFor[DictSectionKind.Tags][ctx.targetLang],
	};
}
