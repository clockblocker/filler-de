import { ok, type Result } from "neverthrow";
import { dictEntryIdHelper } from "../../../../../linguistics/common/dict-entry-id/dict-entry-id";
import {
	type DictEntry,
	dictNoteHelper,
} from "../../../../../stateless-helpers/dict-note";
import { logger } from "../../../../../utils/logger";
import type { CommandError, CommandState } from "../../types";

export type ResolvedEntryState = CommandState & {
	existingEntries: DictEntry[];
	matchedEntry: DictEntry | null;
	nextIndex: number;
};

/**
 * Parse existing note content into DictEntry[], find matching entry using
 * disambiguation result from Lemma step.
 *
 * Two outcomes:
 * A) matchedEntry != null → existing entry found, Generate should just append attestation
 * B) matchedEntry == null → new entry, Generate should run full LLM pipeline
 */
export function resolveExistingEntry(
	ctx: CommandState,
): Result<ResolvedEntryState, CommandError> {
	const lemmaResult = ctx.textfresserState.latestLemmaResult!;
	const content = ctx.commandContext.activeFile.content;

	const existingEntries = dictNoteHelper.parse(content);
	const existingIds = existingEntries.map((e) => e.id);

	const prefix = dictEntryIdHelper.buildPrefix(
		lemmaResult.linguisticUnit,
		lemmaResult.surfaceKind,
		lemmaResult.pos,
	);

	const disambResult = lemmaResult.disambiguationResult;
	let matchedEntry: DictEntry | null = null;

	logger.info(
		`[resolveEntry] disambResult=${disambResult ? `matchedIndex=${disambResult.matchedIndex}` : "null"}`,
	);

	if (disambResult) {
		// Match by unitKind + POS + index, ignoring surfaceKind so that
		// inflected forms find lemma entries and vice versa
		matchedEntry =
			existingEntries.find((e) => {
				const parsed = dictEntryIdHelper.parse(e.id);
				return (
					parsed !== undefined &&
					parsed.index === disambResult.matchedIndex &&
					parsed.unitKind === lemmaResult.linguisticUnit &&
					(!lemmaResult.pos || parsed.pos === lemmaResult.pos)
				);
			}) ?? null;
	}
	// If no disambResult → matchedEntry stays null (new entry)

	logger.info(
		`[resolveEntry] matchedEntry=${matchedEntry ? matchedEntry.id : "null"}`,
	);

	const nextIndex = dictEntryIdHelper.nextIndex(existingIds, prefix);

	return ok({
		...ctx,
		existingEntries,
		matchedEntry,
		nextIndex,
	});
}
