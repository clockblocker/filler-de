import { ok, type Result } from "neverthrow";
import { dictEntryIdHelper } from "../../../../../linguistics/dict-entry-id/dict-entry-id";
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
 * Parse existing note content into DictEntry[], find matching entry by ID prefix.
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

	const matchedEntry =
		existingEntries.find((e) => e.id.startsWith(prefix)) ?? null;
	const nextIndex = dictEntryIdHelper.nextIndex(existingIds, prefix);

	return ok({
		...ctx,
		existingEntries,
		matchedEntry,
		nextIndex,
	});
}
