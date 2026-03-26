import type { LexicalInfo } from "../../../../../../lexical-generation";
import type { EntrySection } from "../../../../domain/dict-note/types";
import type { TextfresserNounInflectionCell } from "../../../../domain/lexical-types";
import { cssSuffixFor } from "../../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../../targets/de/sections/section-kind";
import { formatInflection } from "../../section-formatters/de/lexem/noun/inflection-formatter";
import type { GenerationTargetLanguage } from "../section-generation-types";

export type InflectionSectionContext = {
	lexicalInfo: LexicalInfo;
	targetLang: GenerationTargetLanguage;
};

export type InflectionSectionResult = {
	inflectionCells: TextfresserNounInflectionCell[];
	section: EntrySection | null;
};

function formatGenericInflectionRows(
	rows: Array<{ forms: Array<{ form: string }>; label: string }>,
): string {
	return rows
		.map((row) => {
			const forms = row.forms
				.map((form) => `[[${form.form}]]`)
				.join(", ");
			return `${row.label}: ${forms}`;
		})
		.join("\n");
}

export function generateInflectionSection(
	ctx: InflectionSectionContext,
): InflectionSectionResult {
	let content: string | undefined;
	let inflectionCells: TextfresserNounInflectionCell[] = [];

	if (
		ctx.lexicalInfo.lemma.linguisticUnit === "Lexem" &&
		ctx.lexicalInfo.inflections.status === "ready"
	) {
		if (ctx.lexicalInfo.inflections.value.kind === "noun") {
			const result = formatInflection(ctx.lexicalInfo.inflections.value);
			content = result.formattedSection;
			inflectionCells = result.cells;
		} else {
			content = formatGenericInflectionRows(
				ctx.lexicalInfo.inflections.value.rows,
			);
		}
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
