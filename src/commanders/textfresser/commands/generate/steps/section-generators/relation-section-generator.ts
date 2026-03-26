import type { LexicalInfo } from "@textfresser/lexical-generation";
import { wikilinkHelper } from "../../../../../../stateless-helpers/wikilink";
import type { EntrySection } from "../../../../domain/dict-note/types";
import { cssSuffixFor } from "../../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../targets/de/sections/section-kind";
import { formatRelationSection } from "../../section-formatters/common/relation-formatter";
import type {
	GenerationTargetLanguage,
	ParsedRelation,
} from "../section-generation-types";

export type RelationSectionContext = {
	lexicalInfo: LexicalInfo;
	targetLang: GenerationTargetLanguage;
};

export type RelationSectionResult = {
	relations: ParsedRelation[];
	section: EntrySection | null;
};

function toParsedRelations(lexicalInfo: LexicalInfo): ParsedRelation[] {
	if (lexicalInfo.relations.status !== "ready") {
		return [];
	}

	return lexicalInfo.relations.value.relations.map((relation) => ({
		kind: relation.kind,
		words: relation.words.map((word) =>
			wikilinkHelper.normalizeLinkTarget(word),
		),
	}));
}

export function generateRelationSection(
	ctx: RelationSectionContext,
): RelationSectionResult {
	const relations = toParsedRelations(ctx.lexicalInfo);
	if (ctx.lexicalInfo.relations.status !== "ready") {
		return { relations, section: null };
	}

	const content = formatRelationSection(ctx.lexicalInfo.relations.value);

	if (!content) {
		return { relations, section: null };
	}

	return {
		relations,
		section: {
			content,
			kind: cssSuffixFor[DictSectionKind.Relation],
			title: TitleReprFor[DictSectionKind.Relation][ctx.targetLang],
		},
	};
}
