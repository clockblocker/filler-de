/**
 * Propagate morpheme back-references to target notes.
 *
 * Responsibilities:
 * - bound morphemes (suffix/interfix/etc): maintain `used_in:` backlinks on Morphem notes
 * - prefixes that are not covered by a generated prefix equation: maintain `used_in:` backlinks on Morphem notes
 *
 * Prefixes covered by `propagateMorphologyRelations` prefix equations are skipped
 * here to avoid duplicate propagation.
 */

import { ok, type Result } from "neverthrow";
import type { VaultAction } from "../../../../../managers/obsidian/vault-action-manager";
import { morphologyRelationHelper } from "../../../../../stateless-helpers/morphology-relation";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import type { TargetLanguage } from "../../../../../types";
import {
	buildPropagationActionPair,
	resolveMorphemePath,
} from "../../../common/target-path-resolver";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import { dictNoteHelper } from "../../../domain/dict-note";
import type { DictEntry, EntrySection } from "../../../domain/dict-note/types";
import type { MorphemeItem } from "../../../domain/morpheme/morpheme-formatter";
import { cssSuffixFor } from "../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../targets/de/sections/section-kind";
import type { CommandError } from "../../types";
import type { GenerateSectionsResult } from "./generate-sections";
import { normalizeMorphologyKey } from "./morphology-utils";
import {
	blockHasWikilinkTarget,
	buildUsedInLine,
	extractFirstNonEmptyLine,
	type PropagationResult,
} from "./propagation-line-append";

function buildMorphemeTagContent(item: MorphemeItem): string {
	return `#${item.kind.toLowerCase()}`;
}

function buildMorphologyCoverageKeys(ctx: GenerateSectionsResult): Set<string> {
	const keys = new Set<string>();
	const morphology = ctx.morphology;
	if (!morphology) return keys;

	const add = (raw: string | null | undefined) => {
		const key = normalizeMorphologyKey(raw);
		if (key) {
			keys.add(key);
		}
	};

	add(morphology.derivedFromLemma);
	for (const lemma of morphology.compoundedFromLemmas) {
		add(lemma);
	}
	add(morphology.prefixEquation?.baseLemma);

	return keys;
}

const MORPHOLOGY_STEM_MATCH_MIN_LENGTH = 4;

function hasEquivalentMorphologyKey(key: string, coverageKey: string): boolean {
	if (key === coverageKey) return true;

	const shorter = key.length <= coverageKey.length ? key : coverageKey;
	const longer = shorter === key ? coverageKey : key;
	// TODO calibrate this threshold against real morphology samples.
	if (shorter.length < MORPHOLOGY_STEM_MATCH_MIN_LENGTH) return false;
	return longer.startsWith(shorter);
}

function collectMorphemeKeys(item: MorphemeItem): string[] {
	const keys = new Set<string>();
	const add = (value: string | null | undefined) => {
		const normalized = normalizeMorphologyKey(value);
		if (normalized) {
			keys.add(normalized);
		}
	};
	add(item.linkTarget);
	add(item.lemma);
	add(item.surf);
	return [...keys];
}

function isHandledByPrefixEquation(
	item: MorphemeItem,
	morphology: GenerateSectionsResult["morphology"],
): boolean {
	if (item.kind !== "Prefix" || !item.separability) return false;
	const equationPrefixKey = normalizeMorphologyKey(
		morphology?.prefixEquation?.prefixTarget,
	);
	if (!equationPrefixKey) return false;

	return collectMorphemeKeys(item).some((key) => key === equationPrefixKey);
}

function shouldSkipMorphemeItem(
	item: MorphemeItem,
	morphology: GenerateSectionsResult["morphology"],
	morphologyCoverage: Set<string>,
): boolean {
	if (isHandledByPrefixEquation(item, morphology)) {
		return true;
	}

	if (item.kind !== "Root" && item.kind !== "Suffixoid") {
		return false;
	}

	const itemKeys = collectMorphemeKeys(item);
	if (itemKeys.length === 0) return false;

	for (const key of itemKeys) {
		if (morphologyCoverage.has(key)) {
			return true;
		}
	}

	for (const key of itemKeys) {
		for (const coverageKey of morphologyCoverage) {
			if (hasEquivalentMorphologyKey(key, coverageKey)) {
				return true;
			}
		}
	}

	return false;
}

function appendToUsedInBlock(params: {
	sectionContent: string;
	sourceLemma: string;
	targetLanguage: TargetLanguage;
	usedInLine: string;
}): PropagationResult {
	const blockMarker = morphologyRelationHelper.markerForRelationType(
		"used_in",
		params.targetLanguage,
	);
	const markerAliases =
		morphologyRelationHelper.markerAliasesForRelationType("used_in");
	let blockStart = -1;
	let matchedMarker = blockMarker;
	for (const marker of [blockMarker, ...markerAliases]) {
		const markerStart = params.sectionContent.indexOf(marker);
		if (markerStart < 0) {
			continue;
		}
		if (blockStart < 0 || markerStart < blockStart) {
			blockStart = markerStart;
			matchedMarker = marker;
		}
	}

	if (blockStart < 0) {
		const normalized = trimTrailingNewlines(params.sectionContent);
		const content =
			normalized.length > 0
				? `${normalized}\n${blockMarker}\n${params.usedInLine}`
				: `${blockMarker}\n${params.usedInLine}`;
		return { changed: true, content };
	}

	const blockBodyStart = blockStart + matchedMarker.length;
	const afterBlock = params.sectionContent.slice(blockBodyStart);
	const blockBodyEnd =
		blockBodyStart + findNextMorphologyMarkerOffset(afterBlock);
	const blockContent = params.sectionContent.slice(
		blockBodyStart,
		blockBodyEnd,
	);

	if (blockHasWikilinkTarget(blockContent, params.sourceLemma)) {
		return { changed: false, content: params.sectionContent };
	}

	const existingLines = splitNonEmptyLinesPreservingTrailingSpaces(blockContent);
	const updatedBlock =
		existingLines.length > 0
			? `${existingLines.join("\n")}\n${params.usedInLine}`
			: params.usedInLine;

	const content =
		params.sectionContent.slice(0, blockBodyStart) +
		`\n${updatedBlock}` +
		params.sectionContent.slice(blockBodyEnd);
	return { changed: true, content };
}

function trimTrailingNewlines(text: string): string {
	return text.replace(/\n+$/g, "");
}

function splitNonEmptyLinesPreservingTrailingSpaces(text: string): string[] {
	return text
		.split("\n")
		.filter((line) => line.trim().length > 0);
}

function findNextMorphologyMarkerOffset(text: string): number {
	const regex = /\n([^\n]+)/g;
	for (const match of text.matchAll(regex)) {
		const index = match.index;
		const markerCandidate = match[1];
		if (typeof index !== "number" || typeof markerCandidate !== "string") {
			continue;
		}
		if (morphologyRelationHelper.parseMarker(markerCandidate)) {
			return index;
		}
	}
	return text.length;
}

/**
 * For each morpheme in a multi-morpheme word, generate actions that create
 * or update structured DictEntry on the morpheme's target note.
 */
export function propagateMorphemes(
	ctx: GenerateSectionsResult,
): Result<GenerateSectionsResult, CommandError> {
	const { morphemes } = ctx;
	if (morphemes.length <= 1) {
		return ok(ctx);
	}

	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	const sourceWord = lemmaResult.lemma;
	const sourceGloss = extractFirstNonEmptyLine(ctx.sourceTranslation);
	const usedInLine = buildUsedInLine(sourceWord, sourceGloss);
	const targetLang = ctx.textfresserState.languages.target;
	const morphologyCoverage = buildMorphologyCoverageKeys(ctx);

	const morphologyCssSuffix = cssSuffixFor[DictSectionKind.Morphology];
	const morphologyTitle =
		TitleReprFor[DictSectionKind.Morphology][targetLang];
	const tagsCssSuffix = cssSuffixFor[DictSectionKind.Tags];
	const tagsTitle = TitleReprFor[DictSectionKind.Tags][targetLang];

	const propagationActions: VaultAction[] = [];

	for (const item of morphemes) {
		if (shouldSkipMorphemeItem(item, ctx.morphology, morphologyCoverage)) {
			continue;
		}

		const morphemeWord = item.lemma ?? item.surf;
		if (morphemeWord === sourceWord) continue;

		const resolved = resolveMorphemePath(item, {
			lookupInLibrary: ctx.textfresserState.lookupInLibrary,
			targetLang,
			vam: ctx.textfresserState.vam,
		});
		const targetHeader = item.lemma ?? item.surf;

		const transform = (content: string) => {
			const existingEntries = dictNoteHelper.parse(content);
			const matchedEntry = existingEntries.find(
				(entry) => entry.headerContent === targetHeader,
			);

			if (matchedEntry) {
				const morphologySection = matchedEntry.sections.find(
					(section) => section.kind === morphologyCssSuffix,
				);

				if (morphologySection) {
					const updatedMorphology = appendToUsedInBlock({
						sectionContent: morphologySection.content,
						sourceLemma: sourceWord,
						targetLanguage: targetLang,
						usedInLine,
					});
					if (!updatedMorphology.changed) {
						return content;
					}
					morphologySection.content = updatedMorphology.content;
				} else {
					matchedEntry.sections.push({
						content: `${morphologyRelationHelper.markerForRelationType(
							"used_in",
							targetLang,
						)}\n${usedInLine}`,
						kind: morphologyCssSuffix,
						title: morphologyTitle,
					});
				}

				const { body, meta } =
					dictNoteHelper.serialize(existingEntries);
				if (Object.keys(meta).length > 0) {
					return noteMetadataHelper.upsert(meta)(body) as string;
				}
				return body;
			}

			const existingIds = existingEntries.map((entry) => entry.id);
			const prefix = dictEntryIdHelper.buildPrefix("Morphem", "Lemma");
			const entryId = dictEntryIdHelper.build({
				index: dictEntryIdHelper.nextIndex(existingIds, prefix),
				surfaceKind: "Lemma",
				unitKind: "Morphem",
			});

			const sections: EntrySection[] = [
				{
					content: buildMorphemeTagContent(item),
					kind: tagsCssSuffix,
					title: tagsTitle,
				},
				{
					content: `${morphologyRelationHelper.markerForRelationType(
						"used_in",
						targetLang,
					)}\n${usedInLine}`,
					kind: morphologyCssSuffix,
					title: morphologyTitle,
				},
			];

			const newEntry: DictEntry = {
				headerContent: targetHeader,
				id: entryId,
				meta: {},
				sections,
			};

			const allEntries = [...existingEntries, newEntry];
			const { body, meta } = dictNoteHelper.serialize(allEntries);
			if (Object.keys(meta).length > 0) {
				return noteMetadataHelper.upsert(meta)(body) as string;
			}
			return body;
		};

		propagationActions.push(...resolved.healingActions);
		propagationActions.push(
			...buildPropagationActionPair(resolved.splitPath, transform),
		);
	}

	return ok({
		...ctx,
		actions: [...ctx.actions, ...propagationActions],
	});
}
