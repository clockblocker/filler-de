import {
	type CaseValue,
	caseValueFromLocalizedLabel,
	getCaseLabelForTargetLanguage,
	getNumberLabelForTargetLanguage,
	type NumberValue,
	numberValueFromLocalizedLabel,
} from "../../../../../../linguistics/common/enums/inflection/feature-values";
import {
	CASE_ORDER,
	type GermanGenus,
	getGermanGenusLabelForTargetLanguage,
	type NounInflectionCell,
} from "../../../../../../linguistics/de/lexem/noun";
import type { TargetLanguage } from "../../../../../../types";

const NUMBER_ORDER: readonly NumberValue[] = ["Singular", "Plural"];
const NUMBER_ORDER_INDEX = new Map(
	NUMBER_ORDER.map((numberValue, idx) => [numberValue, idx] as const),
);
const CASE_ORDER_INDEX = new Map(
	CASE_ORDER.map((caseValue, idx) => [caseValue, idx] as const),
);

const INFLECTION_TAG_RE = /^#([^/\s]+)\/([^/\s]+)$/;
const LEGACY_HEADER_RE = /^#([^/\s]+)\/([^/\s]+) for: \[\[(.+)\]\]$/;

export type ParsedInflectionTag = {
	caseValue: CaseValue;
	numberValue: NumberValue;
	tag: string;
};

function sortAndDedupeTags(
	tags: string[],
	targetLanguage: TargetLanguage,
): string[] {
	const normalized = new Map<string, ParsedInflectionTag | null>();

	for (const rawTag of tags) {
		const parsed = parseLocalizedInflectionTag(rawTag, targetLanguage);
		const normalizedTag = parsed?.tag ?? rawTag.trim();
		if (normalizedTag.length === 0) continue;
		if (!normalized.has(normalizedTag)) {
			normalized.set(normalizedTag, parsed);
		}
	}

	return [...normalized.entries()]
		.sort(([leftTag, leftParsed], [rightTag, rightParsed]) => {
			if (leftParsed && rightParsed) {
				const leftCaseIdx =
					CASE_ORDER_INDEX.get(leftParsed.caseValue) ??
					Number.MAX_SAFE_INTEGER;
				const rightCaseIdx =
					CASE_ORDER_INDEX.get(rightParsed.caseValue) ??
					Number.MAX_SAFE_INTEGER;
				if (leftCaseIdx !== rightCaseIdx) {
					return leftCaseIdx - rightCaseIdx;
				}

				const leftNumberIdx =
					NUMBER_ORDER_INDEX.get(leftParsed.numberValue) ??
					Number.MAX_SAFE_INTEGER;
				const rightNumberIdx =
					NUMBER_ORDER_INDEX.get(rightParsed.numberValue) ??
					Number.MAX_SAFE_INTEGER;
				if (leftNumberIdx !== rightNumberIdx) {
					return leftNumberIdx - rightNumberIdx;
				}
			}

			if (leftParsed && !rightParsed) return -1;
			if (!leftParsed && rightParsed) return 1;
			return leftTag.localeCompare(rightTag);
		})
		.map(([tag]) => tag);
}

export function buildNounInflectionPropagationHeader(
	lemma: string,
	genus: GermanGenus | undefined,
	targetLanguage: TargetLanguage,
): string {
	if (!genus) {
		return `#Inflection/Noun for: [[${lemma}]]`;
	}
	const genusLabel = getGermanGenusLabelForTargetLanguage(
		genus,
		targetLanguage,
	);
	return `#Inflection/Noun/${genusLabel} for: [[${lemma}]]`;
}

function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isNounInflectionPropagationHeaderForLemma(
	header: string,
	lemma: string,
): boolean {
	const escapedLemma = escapeRegex(lemma);
	const re = new RegExp(
		`^#Inflection/Noun(?:/[^\\s]+)? for: \\[\\[${escapedLemma}\\]\\]$`,
	);
	return re.test(header);
}

export function buildLocalizedInflectionTag(
	caseValue: CaseValue,
	numberValue: NumberValue,
	targetLanguage: TargetLanguage,
): string {
	const caseLabel = getCaseLabelForTargetLanguage(caseValue, targetLanguage);
	const numberLabel = getNumberLabelForTargetLanguage(
		numberValue,
		targetLanguage,
	);
	return `#${caseLabel}/${numberLabel}`;
}

export function parseLocalizedInflectionTag(
	tag: string,
	targetLanguage: TargetLanguage,
): ParsedInflectionTag | null {
	const match = tag.match(INFLECTION_TAG_RE);
	if (!match) return null;

	const caseLabel = match[1];
	const numberLabel = match[2];
	if (!caseLabel || !numberLabel) return null;

	const caseValue = caseValueFromLocalizedLabel(caseLabel);
	const numberValue = numberValueFromLocalizedLabel(numberLabel);
	if (!caseValue || !numberValue) return null;

	return {
		caseValue,
		numberValue,
		tag: buildLocalizedInflectionTag(
			caseValue,
			numberValue,
			targetLanguage,
		),
	};
}

export function parseLegacyInflectionHeaderTag(
	header: string,
	lemma: string,
	targetLanguage: TargetLanguage,
): string | null {
	const match = header.match(LEGACY_HEADER_RE);
	if (!match) return null;

	const caseLabel = match[1];
	const numberLabel = match[2];
	const headerLemma = match[3];
	if (!caseLabel || !numberLabel || !headerLemma) return null;
	if (headerLemma !== lemma) return null;

	const caseValue = caseValueFromLocalizedLabel(caseLabel);
	const numberValue = numberValueFromLocalizedLabel(numberLabel);
	if (!caseValue || !numberValue) return null;

	return buildLocalizedInflectionTag(caseValue, numberValue, targetLanguage);
}

import { extractHashTags } from "../../../../../../utils/text-utils";
export { extractHashTags };

export function buildLocalizedInflectionTagsFromCells(
	cells: NounInflectionCell[],
	targetLanguage: TargetLanguage,
): string[] {
	const tags = cells.map((cell) =>
		buildLocalizedInflectionTag(cell.case, cell.number, targetLanguage),
	);
	return sortAndDedupeTags(tags, targetLanguage);
}

export function mergeLocalizedInflectionTags(
	existingContent: string,
	newTags: string[],
	targetLanguage: TargetLanguage,
): string {
	const existingTags = extractHashTags(existingContent);
	const mergedTags = sortAndDedupeTags(
		[...existingTags, ...newTags],
		targetLanguage,
	);
	return mergedTags.join(" ");
}
