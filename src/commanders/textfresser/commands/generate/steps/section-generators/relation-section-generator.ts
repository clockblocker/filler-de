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
	RelationOutput,
} from "../section-generation-types";

export type RelationSectionContext = {
	output: RelationOutput;
	targetLang: GenerationTargetLanguage;
};

export type RelationSectionResult = {
	relations: ParsedRelation[];
	section: EntrySection | null;
};

function toParsedRelations(output: RelationOutput): ParsedRelation[] {
	return output.relations.map((relation) => ({
		kind: relation.kind,
		words: relation.words,
	}));
}

export function generateRelationSection(
	ctx: RelationSectionContext,
): RelationSectionResult {
	const relations = toParsedRelations(ctx.output);
	const content = formatRelationSection(ctx.output);

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
