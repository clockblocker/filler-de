import { ok, type Result } from "neverthrow";
import { SurfaceKind } from "../../../../../linguistics/common/enums/core";
import type { VaultAction } from "../../../../../managers/obsidian/vault-action-manager";
import { morphologyRelationHelper } from "../../../../../stateless-helpers/morphology-relation";
import { wikilinkHelper } from "../../../../../stateless-helpers/wikilink";
import {
	buildPropagationActionPair,
	resolveMorphemePath,
	resolveTargetPath,
} from "../../../common/target-path-resolver";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import { dictNoteHelper } from "../../../domain/dict-note";
import { buildSectionMarkerHtml } from "../../../domain/dict-note/internal/constants";
import type { DictEntry, EntrySection } from "../../../domain/dict-note/types";
import {
	type MorphemeItem,
	morphemeFormatterHelper,
} from "../../../domain/morpheme/morpheme-formatter";
import { cssSuffixFor } from "../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../targets/de/sections/section-kind";
import type { CommandError } from "../../types";
import type { GenerateSectionsResult } from "./generate-sections";
import { normalizeLemma, normalizeMorphologyKey } from "./morphology-utils";
import {
	appendUniqueLinesToSection,
	appendUniqueLinesToSectionBlock,
	blockHasWikilinkTarget,
	buildUsedInLine,
	extractFirstNonEmptyLine,
	type PropagationResult,
	splitLines,
} from "./propagation-line-append";

type UsedInTarget = {
	kind: "UsedIn";
	lines: string[];
	targetWord: string;
	targetUnit: "Lexem" | "Phrasem" | "Morphem";
};

type EquationTarget = {
	kind: "Equation";
	lines: string[];
	targetHeader: string;
	targetWord: string;
	prefixItem: MorphemeItem;
	tagLine: string;
};

type MorphologyTarget = UsedInTarget | EquationTarget;

function hasEquivalentEquationLine(
	existingBlock: string,
	candidateLine: string,
): boolean {
	const candidateTargets = extractLineTargetSignature(candidateLine);
	if (candidateTargets.length === 0) return false;

	return splitLines(existingBlock).some((existingLine) => {
		const existingTargets = extractLineTargetSignature(existingLine);
		if (existingTargets.length !== candidateTargets.length) {
			return false;
		}
		return existingTargets.every((target, index) => {
			const other = candidateTargets[index];
			return other !== undefined && target === other;
		});
	});
}

function extractLineTargetSignature(line: string): string[] {
	return wikilinkHelper
		.parse(line)
		.map((wikilink) => wikilinkHelper.normalizeTarget(wikilink.target))
		.filter((target) => target.length > 0);
}

function appendEquationLine(params: {
	candidateLine: string;
	currentSectionContent: string;
	sourceLemma: string;
}): PropagationResult {
	const normalized = params.currentSectionContent.trimEnd();
	if (
		blockHasWikilinkTarget(normalized, params.sourceLemma) ||
		hasEquivalentEquationLine(normalized, params.candidateLine)
	) {
		return { changed: false, content: params.currentSectionContent };
	}

	const content =
		normalized.length > 0
			? `${normalized}\n${params.candidateLine}`
			: params.candidateLine;
	return { changed: true, content };
}

function buildTargets(ctx: GenerateSectionsResult): MorphologyTarget[] {
	const morphology = ctx.morphology;
	if (!morphology) return [];

	const sourceLemma = ctx.textfresserState.latestLemmaResult.lemma;
	const sourceGloss = extractFirstNonEmptyLine(ctx.sourceTranslation);
	const usedInLine = buildUsedInLine(sourceLemma, sourceGloss);
	const targets: MorphologyTarget[] = [];

	const derivedFrom = normalizeLemma(morphology.derivedFromLemma);
	if (
		derivedFrom &&
		wikilinkHelper.normalizeTarget(derivedFrom) !==
			wikilinkHelper.normalizeTarget(sourceLemma)
	) {
		targets.push({
			kind: "UsedIn",
			lines: [usedInLine],
			targetUnit: ctx.textfresserState.latestLemmaResult.linguisticUnit,
			targetWord: derivedFrom,
		});
	}

	for (const lemma of morphology.compoundedFromLemmas) {
		const normalized = normalizeLemma(lemma);
		if (!normalized) continue;
		if (
			wikilinkHelper.normalizeTarget(normalized) ===
			wikilinkHelper.normalizeTarget(sourceLemma)
		) {
			continue;
		}
		targets.push({
			kind: "UsedIn",
			lines: [usedInLine],
			targetUnit: ctx.textfresserState.latestLemmaResult.linguisticUnit,
			targetWord: normalized,
		});
	}

	if (morphology.prefixEquation) {
		const targetWord = normalizeLemma(
			morphology.prefixEquation.prefixTarget,
		);
		if (
			targetWord &&
			wikilinkHelper.normalizeTarget(targetWord) !==
				wikilinkHelper.normalizeTarget(sourceLemma)
		) {
			const targetKey = normalizeMorphologyKey(targetWord);
			if (targetKey) {
				const prefixItem = ctx.morphemes.find(
					(item) =>
						item.kind === "Prefix" &&
						Boolean(item.separability) &&
						normalizeMorphologyKey(
							item.linkTarget ?? item.lemma ?? item.surf,
						) === targetKey,
				);
				if (prefixItem?.separability) {
					const sourceGlossSuffix = sourceGloss
						? ` *(${sourceGloss})* `
						: "";
					const targetHeader =
						morphemeFormatterHelper.decorateSurface(
							prefixItem.surf,
							prefixItem.separability,
							ctx.textfresserState.languages.target,
						);

					targets.push({
						kind: "Equation",
						lines: [
							`[[${morphology.prefixEquation.prefixTarget}|${morphology.prefixEquation.prefixDisplay}]] + [[${morphology.prefixEquation.baseLemma}]] = [[${morphology.prefixEquation.sourceLemma}]]${sourceGlossSuffix}`,
						],
						prefixItem,
						tagLine: `#prefix/${prefixItem.separability.toLowerCase()}`,
						targetHeader,
						targetWord,
					});
				}
			}
		}
	}

	return targets;
}

function groupTargets(
	targets: MorphologyTarget[],
): Map<string, MorphologyTarget> {
	const grouped = new Map<string, MorphologyTarget>();
	for (const target of targets) {
		const key =
			target.kind === "Equation"
				? `${target.kind}::${wikilinkHelper.normalizeTarget(target.targetWord)}::${target.targetHeader}`
				: `${target.kind}::${wikilinkHelper.normalizeTarget(target.targetWord)}`;
		const existing = grouped.get(key);
		if (!existing) {
			grouped.set(key, target);
			continue;
		}
		existing.lines.push(...target.lines);
	}
	return grouped;
}

export function propagateMorphologyRelations(
	ctx: GenerateSectionsResult,
): Result<GenerateSectionsResult, CommandError> {
	const targets = buildTargets(ctx);
	if (targets.length === 0) return ok(ctx);

	const groupedTargets = groupTargets(targets);
	const targetLang = ctx.textfresserState.languages.target;
	const sourceLemma = ctx.textfresserState.latestLemmaResult.lemma;
	const sectionCssSuffix = cssSuffixFor[DictSectionKind.Morphology];
	const sectionTitle = TitleReprFor[DictSectionKind.Morphology][targetLang];
	const sectionMarker = buildSectionMarkerHtml(
		sectionCssSuffix,
		sectionTitle,
	);
	const usedInBlockMarker = morphologyRelationHelper.markerForRelationType(
		"used_in",
		targetLang,
	);
	const usedInBlockMarkerAliases =
		morphologyRelationHelper.markerAliasesForRelationType("used_in");
	const tagsCssSuffix = cssSuffixFor[DictSectionKind.Tags];
	const tagsTitle = TitleReprFor[DictSectionKind.Tags][targetLang];

	const propagationActions: VaultAction[] = [];

	for (const target of groupedTargets.values()) {
		const resolved =
			target.kind === "Equation"
				? resolveMorphemePath(target.prefixItem, {
						lookupInLibrary: ctx.textfresserState.lookupInLibrary,
						targetLang,
						vam: ctx.textfresserState.vam,
					})
				: resolveTargetPath({
						desiredSurfaceKind: SurfaceKind.Lemma,
						librarianLookup: ctx.textfresserState.lookupInLibrary,
						targetLanguage: targetLang,
						unitKind: target.targetUnit,
						vamLookup: (word) =>
							ctx.textfresserState.vam.findByBasename(word),
						word: target.targetWord,
					});

		const transform =
			target.kind === "UsedIn"
				? (content: string) =>
						appendUniqueLinesToSectionBlock({
							blockMarker: usedInBlockMarker,
							blockMarkerAliases: usedInBlockMarkerAliases,
							content,
							lines: target.lines,
							sectionMarker,
							shouldSkipLine: ({ currentBlockContent }) =>
								blockHasWikilinkTarget(
									currentBlockContent,
									sourceLemma,
								),
						})
				: (content: string) => {
						const candidateLine = target.lines[0];
						if (!candidateLine) {
							return content;
						}

						const existingEntries = dictNoteHelper.parse(content);
						if (
							existingEntries.length === 0 &&
							content.trim().length > 0
						) {
							return appendUniqueLinesToSection({
								content,
								lines: [candidateLine],
								sectionMarker,
								shouldSkipLine: ({
									candidateLine: currentCandidate,
									currentBlockContent,
								}) =>
									blockHasWikilinkTarget(
										currentBlockContent,
										sourceLemma,
									) ||
									hasEquivalentEquationLine(
										currentBlockContent,
										currentCandidate,
									),
							});
						}

						const matchedEntry = existingEntries.find(
							(entry) =>
								entry.headerContent === target.targetHeader,
						);

						if (matchedEntry) {
							const morphologySection =
								matchedEntry.sections.find(
									(section) =>
										section.kind === sectionCssSuffix,
								);
							if (morphologySection) {
								const updated = appendEquationLine({
									candidateLine,
									currentSectionContent:
										morphologySection.content,
									sourceLemma,
								});
								if (!updated.changed) {
									return content;
								}
								morphologySection.content = updated.content;
							} else {
								matchedEntry.sections.push({
									content: candidateLine,
									kind: sectionCssSuffix,
									title: sectionTitle,
								});
							}

							return dictNoteHelper.serializeWithMeta(
								existingEntries,
							);
						}

						const existingIds = existingEntries.map(
							(entry) => entry.id,
						);
						const prefix = dictEntryIdHelper.buildPrefix(
							"Morphem",
							"Lemma",
						);
						const entryId = dictEntryIdHelper.build({
							index: dictEntryIdHelper.nextIndex(
								existingIds,
								prefix,
							),
							surfaceKind: "Lemma",
							unitKind: "Morphem",
						});

						const sections: EntrySection[] = [
							{
								content: target.tagLine,
								kind: tagsCssSuffix,
								title: tagsTitle,
							},
							{
								content: candidateLine,
								kind: sectionCssSuffix,
								title: sectionTitle,
							},
						];

						const newEntry: DictEntry = {
							headerContent: target.targetHeader,
							id: entryId,
							meta: {},
							sections,
						};

						return dictNoteHelper.serializeWithMeta([
							...existingEntries,
							newEntry,
						]);
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
