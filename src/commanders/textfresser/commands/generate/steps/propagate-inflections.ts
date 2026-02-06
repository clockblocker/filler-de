import { ok, type Result } from "neverthrow";
import { dictEntryIdHelper } from "../../../../../linguistics/common/dict-entry-id/dict-entry-id";
import type { CaseValue } from "../../../../../linguistics/common/enums/inflection/feature-values";
import type { NounInflectionCell } from "../../../../../linguistics/german/inflection/noun";
import {
	CASE_ORDER,
	GERMAN_CASE_TAG,
	GERMAN_NUMBER_TAG,
} from "../../../../../linguistics/german/inflection/noun";
import type { VaultAction } from "../../../../../managers/obsidian/vault-action-manager";
import {
	SplitPathKind,
	type SplitPathToMdFile,
} from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import { VaultActionKind } from "../../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { dictNoteHelper } from "../../../../../stateless-helpers/dict-note";
import type { DictEntry } from "../../../../../stateless-helpers/dict-note/types";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import { computeShardedFolderParts } from "../../../common/sharded-path";
import type { CommandError } from "../../types";
import type { GenerateSectionsResult } from "./generate-sections";

function buildTargetSplitPath(word: string): SplitPathToMdFile {
	return {
		basename: word,
		extension: "md",
		kind: SplitPathKind.MdFile,
		pathParts: computeShardedFolderParts(word),
	};
}

/**
 * Build a combined header for all inflection cells sharing the same form.
 * Collects unique case tags (in CASE_ORDER) and number tags, then formats:
 *   `#Nominativ #Akkusativ #Genitiv #Plural for: [[lemma]]`
 */
function buildCombinedHeader(
	cells: NounInflectionCell[],
	lemma: string,
): string {
	const caseSet = new Set<CaseValue>(cells.map((c) => c.case));
	const caseParts = CASE_ORDER.filter((c) => caseSet.has(c)).map(
		(c) => GERMAN_CASE_TAG[c],
	);

	const numberParts: string[] = [];
	if (cells.some((c) => c.number === "Singular"))
		numberParts.push(GERMAN_NUMBER_TAG.Singular);
	if (cells.some((c) => c.number === "Plural"))
		numberParts.push(GERMAN_NUMBER_TAG.Plural);

	const tag = [...caseParts, ...numberParts].join("/");
	return `#${tag} for: [[${lemma}]]`;
}

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

/**
 * Propagate noun inflection cells to target notes.
 *
 * For each inflected form, creates a single stub entry with combined case/number tags.
 * Forms that differ from the lemma → UpsertMdFile + ProcessMdFile actions.
 * Forms equal to the lemma → appended directly to ctx.allEntries (same note).
 */
export function propagateInflections(
	ctx: GenerateSectionsResult,
): Result<GenerateSectionsResult, CommandError> {
	const { inflectionCells } = ctx;
	if (inflectionCells.length === 0) {
		return ok(ctx);
	}

	const lemmaResult = ctx.textfresserState.latestLemmaResult!;
	const lemma = lemmaResult.lemma;

	const byForm = groupByForm(inflectionCells);
	const propagationActions: VaultAction[] = [];
	const sameNoteEntries: DictEntry[] = [];

	for (const [form, cells] of byForm) {
		const headerContent = buildCombinedHeader(cells, lemma);

		if (form === lemma) {
			// Same note — check dedup, then append one combined entry
			const alreadyExists = ctx.allEntries.some(
				(e) => e.headerContent === headerContent,
			);
			if (alreadyExists) continue;

			const existingIds = [
				...ctx.allEntries.map((e) => e.id),
				...sameNoteEntries.map((e) => e.id),
			];
			const prefix = dictEntryIdHelper.buildPrefix(
				"Lexem",
				"Single",
				"Noun",
			);
			const entryId = dictEntryIdHelper.build({
				index: dictEntryIdHelper.nextIndex(existingIds, prefix),
				pos: "Noun",
				surfaceKind: "Single",
				unitKind: "Lexem",
			});

			sameNoteEntries.push({
				headerContent,
				id: entryId,
				meta: {},
				sections: [],
			});
			continue;
		}

		// Different note — create UpsertMdFile + ProcessMdFile
		const splitPath = buildTargetSplitPath(form);

		const upsertAction: VaultAction = {
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: null, splitPath },
		};

		const processAction: VaultAction = {
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath,
				transform: (content: string) => {
					const existingEntries = dictNoteHelper.parse(content);
					const existingHeaders = new Set(
						existingEntries.map((e) => e.headerContent),
					);

					if (existingHeaders.has(headerContent)) return content;

					const existingIds = existingEntries.map((e) => e.id);
					const prefix = dictEntryIdHelper.buildPrefix(
						"Lexem",
						"Single",
						"Noun",
					);
					const entryId = dictEntryIdHelper.build({
						index: dictEntryIdHelper.nextIndex(existingIds, prefix),
						pos: "Noun",
						surfaceKind: "Single",
						unitKind: "Lexem",
					});

					const newEntry: DictEntry = {
						headerContent,
						id: entryId,
						meta: {},
						sections: [],
					};

					const allEntries = [...existingEntries, newEntry];
					const { body, meta } = dictNoteHelper.serialize(allEntries);

					if (Object.keys(meta).length > 0) {
						const transform = noteMetadataHelper.upsert(meta);
						return transform(body) as string;
					}
					return body;
				},
			},
		};

		propagationActions.push(upsertAction, processAction);
	}

	return ok({
		...ctx,
		actions: [...ctx.actions, ...propagationActions],
		allEntries: [...ctx.allEntries, ...sameNoteEntries],
	});
}
