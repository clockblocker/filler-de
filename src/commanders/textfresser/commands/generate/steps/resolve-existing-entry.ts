import { ok, type Result } from "neverthrow";
import { dictEntryIdHelper } from "../../../../../linguistics/common/dict-entry-id/dict-entry-id";
import {
	type DictEntry,
	dictNoteHelper,
} from "../../../../../stateless-helpers/dict-note";
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

	if (disambResult) {
		// Use disambiguation result to find the exact entry by index
		matchedEntry =
			existingEntries.find((e) => {
				const parsed = dictEntryIdHelper.parse(e.id);
				return (
					parsed !== undefined &&
					e.id.startsWith(prefix) &&
					parsed.index === disambResult.matchedIndex
				);
			}) ?? null;
	}
	// If no disambResult → matchedEntry stays null (new entry)

	const nextIndex = dictEntryIdHelper.nextIndex(existingIds, prefix);

	return ok({
		...ctx,
		existingEntries,
		matchedEntry,
		nextIndex,
	});
}
