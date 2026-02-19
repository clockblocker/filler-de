import { ok, type Result } from "neverthrow";
import { SurfaceKind } from "../../../../../linguistics/common/enums/core";
import type { NounInflectionCell } from "../../../../../linguistics/de/lexem/noun";
import type { VaultAction } from "../../../../../managers/obsidian/vault-action-manager";
import { logger } from "../../../../../utils/logger";
import {
	buildPropagationActionPair,
	resolveTargetPath,
} from "../../../common/target-path-resolver";
import { dictEntryIdHelper } from "../../../domain/dict-entry-id";
import { dictNoteHelper } from "../../../domain/dict-note";
import type { DictEntry, EntrySection } from "../../../domain/dict-note/types";
import { cssSuffixFor } from "../../../targets/de/sections/section-css-kind";
import {
	DictSectionKind,
	TitleReprFor,
} from "../../../targets/de/sections/section-kind";
import type { CommandError } from "../../types";
import {
	buildLocalizedInflectionTagsFromCells,
	buildNounInflectionPropagationHeader,
	extractHashTags,
	isNounInflectionPropagationHeaderForLemma,
	mergeLocalizedInflectionTags,
	parseLegacyInflectionHeaderTag,
} from "../section-formatters/common/inflection-propagation-helper";
import type { GenerateSectionsResult } from "./generate-sections";

/** Group cells by form word. */
function groupByForm(
	cells: NounInflectionCell[],
): Map<string, NounInflectionCell[]> {
	const map = new Map<string, NounInflectionCell[]>();
	for (const cell of cells) {
		const group = map.get(cell.form) ?? [];
		group.push(cell);
		map.set(cell.form, group);
	}
	return map;
}

function createTagsSection(
	content: string,
	targetLanguage: GenerateSectionsResult["textfresserState"]["languages"]["target"],
): EntrySection {
	return {
		content,
		kind: cssSuffixFor[DictSectionKind.Tags],
		title: TitleReprFor[DictSectionKind.Tags][targetLanguage],
	};
}

function findTagsSection(entry: DictEntry): EntrySection | undefined {
	return entry.sections.find(
		(section) => section.kind === cssSuffixFor[DictSectionKind.Tags],
	);
}

/**
 * Propagate noun inflection cells to target notes.
 *
 * For each inflected form, creates or updates one inflection entry per lemma/POS
 * and stores all case/number variants as tags in a tags section.
 * Also auto-collapses legacy per-cell entries into the single-entry format.
 */
export function propagateInflections(
	ctx: GenerateSectionsResult,
): Result<GenerateSectionsResult, CommandError> {
	const { inflectionCells } = ctx;
	if (inflectionCells.length === 0) {
		return ok(ctx);
	}

	const lemmaResult = ctx.textfresserState.latestLemmaResult;
	const lemma = lemmaResult.lemma;
	const targetLanguage = ctx.textfresserState.languages.target;
	const nounInflectionGenus = ctx.nounInflectionGenus;
	const desiredHeader = buildNounInflectionPropagationHeader(
		lemma,
		nounInflectionGenus,
		targetLanguage,
	);
	if (!nounInflectionGenus) {
		logger.warn(
			"[propagateInflections] Noun genus missing, using fallback header without genus",
			{ header: desiredHeader, lemma },
		);
	}

	const byForm = groupByForm(inflectionCells);
	const propagationActions: VaultAction[] = [];

	for (const [form, cells] of byForm) {
		if (form === lemma) continue;

		const tagsFromCells = buildLocalizedInflectionTagsFromCells(
			cells,
			targetLanguage,
		);

		// Different note — resolve path + create UpsertMdFile + ProcessMdFile
		const resolved = resolveTargetPath({
			desiredSurfaceKind: SurfaceKind.Inflected,
			librarianLookup: ctx.textfresserState.lookupInLibrary,
			targetLanguage,
			unitKind: lemmaResult.linguisticUnit,
			vamLookup: (w) => ctx.textfresserState.vam.findByBasename(w),
			word: form,
		});

		const transform = (content: string) => {
			const existingEntries = dictNoteHelper.parse(content);
			const legacyEntryIndexes: number[] = [];
			const matchingEntryIndexes: number[] = [];
			const tagsFromLegacyHeaders: string[] = [];
			const tagsFromExistingMatches: string[] = [];

			for (let index = 0; index < existingEntries.length; index++) {
				const entry = existingEntries[index];
				if (!entry) continue;

				if (
					isNounInflectionPropagationHeaderForLemma(
						entry.headerContent,
						lemma,
					)
				) {
					matchingEntryIndexes.push(index);
					const tagsSection = findTagsSection(entry);
					if (tagsSection) {
						tagsFromExistingMatches.push(
							...extractHashTags(tagsSection.content),
						);
					}
					continue;
				}

				const legacyTag = parseLegacyInflectionHeaderTag(
					entry.headerContent,
					lemma,
					targetLanguage,
				);
				if (legacyTag) {
					legacyEntryIndexes.push(index);
					tagsFromLegacyHeaders.push(legacyTag);
				}
			}

			const indexesToRemove = new Set<number>([
				...legacyEntryIndexes,
				...matchingEntryIndexes.slice(1),
			]);
			const compactedEntries = existingEntries.filter(
				(_, index) => !indexesToRemove.has(index),
			);
			let didChange = indexesToRemove.size > 0;
			let targetEntry: DictEntry | undefined;

			if (matchingEntryIndexes.length > 0) {
				const firstMatchIndex = matchingEntryIndexes[0];
				if (firstMatchIndex !== undefined) {
					targetEntry = existingEntries[firstMatchIndex];
				}
			}

			const tagsToMerge = [
				...tagsFromCells,
				...tagsFromLegacyHeaders,
				...tagsFromExistingMatches,
			];

			if (!targetEntry) {
				const existingIds = compactedEntries.map((entry) => entry.id);
				const prefix = dictEntryIdHelper.buildPrefix(
					"Lexem",
					"Inflected",
					"Noun",
				);
				const entryId = dictEntryIdHelper.build({
					index: dictEntryIdHelper.nextIndex(existingIds, prefix),
					pos: "Noun",
					surfaceKind: "Inflected",
					unitKind: "Lexem",
				});

				const newEntry: DictEntry = {
					headerContent: desiredHeader,
					id: entryId,
					meta: {},
					sections: [createTagsSection("", targetLanguage)],
				};
				compactedEntries.push(newEntry);
				targetEntry = newEntry;
				didChange = true;
			}

			const tagsSection = findTagsSection(targetEntry);
			const existingTagContent = tagsSection?.content ?? "";
			const mergedTagContent = mergeLocalizedInflectionTags(
				existingTagContent,
				tagsToMerge,
				targetLanguage,
			);

			if (tagsSection) {
				if (tagsSection.content !== mergedTagContent) {
					tagsSection.content = mergedTagContent;
					didChange = true;
				}
			} else {
				targetEntry.sections.push(
					createTagsSection(mergedTagContent, targetLanguage),
				);
				didChange = true;
			}
			if (targetEntry.headerContent !== desiredHeader) {
				targetEntry.headerContent = desiredHeader;
				didChange = true;
			}

			if (!didChange) return content;

			return dictNoteHelper.serializeToString(compactedEntries);
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
