import { ok, type Result } from "neverthrow";
import { dictEntryIdHelper } from "../../../../../linguistics/common/dict-entry-id/dict-entry-id";
import { SurfaceKind } from "../../../../../linguistics/common/enums/core";
import {
	GERMAN_CASE_TAG,
	GERMAN_NUMBER_TAG,
	type NounInflectionCell,
} from "../../../../../linguistics/de/lexem/noun";
import type { VaultAction } from "../../../../../managers/obsidian/vault-action-manager";
import { dictNoteHelper } from "../../../../../stateless-helpers/dict-note";
import type { DictEntry } from "../../../../../stateless-helpers/dict-note/types";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import {
	buildPropagationActionPair,
	resolveTargetPath,
} from "../../../common/target-path-resolver";
import type { CommandError } from "../../types";
import type { GenerateSectionsResult } from "./generate-sections";

/** Build a per-cell header: `#Nominativ/Singular for: [[lemma]]` */
function buildCellHeader(cell: NounInflectionCell, lemma: string): string {
	const caseTag = GERMAN_CASE_TAG[cell.case];
	const numberTag = GERMAN_NUMBER_TAG[cell.number];
	return `#${caseTag}/${numberTag} for: [[${lemma}]]`;
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
 * For each inflected form, creates one stub entry per cell (case/number combo).
 * Forms that differ from the lemma → UpsertMdFile + ProcessMdFile actions.
 * Forms equal to the lemma → skipped (the main entry already lives on that note).
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

	const byForm = groupByForm(inflectionCells);
	const propagationActions: VaultAction[] = [];

	for (const [form, cells] of byForm) {
		if (form === lemma) continue;

		const cellHeaders = cells.map((c) => buildCellHeader(c, lemma));

		// Different note — resolve path + create UpsertMdFile + ProcessMdFile
		const resolved = resolveTargetPath({
			desiredSurfaceKind: SurfaceKind.Inflected,
			librarianLookup: ctx.textfresserState.lookupInLibrary,
			targetLanguage: ctx.textfresserState.languages.target,
			unitKind: lemmaResult.linguisticUnit,
			vamLookup: (w) => ctx.textfresserState.vam.findByBasename(w),
			word: form,
		});

		const transform = (content: string) => {
			const existingEntries = dictNoteHelper.parse(content);
			const existingHeaders = new Set(
				existingEntries.map((e) => e.headerContent),
			);

			const newEntries: DictEntry[] = [];
			const addedHeaders = new Set<string>();

			for (const header of cellHeaders) {
				if (existingHeaders.has(header)) continue;
				if (addedHeaders.has(header)) continue;

				const existingIds = [
					...existingEntries.map((e) => e.id),
					...newEntries.map((e) => e.id),
				];
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

				newEntries.push({
					headerContent: header,
					id: entryId,
					meta: {},
					sections: [],
				});
				addedHeaders.add(header);
			}

			if (newEntries.length === 0) return content;

			const allEntries = [...existingEntries, ...newEntries];
			const { body, meta } = dictNoteHelper.serialize(allEntries);

			if (Object.keys(meta).length > 0) {
				const metaTransform = noteMetadataHelper.upsert(meta);
				return metaTransform(body) as string;
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
