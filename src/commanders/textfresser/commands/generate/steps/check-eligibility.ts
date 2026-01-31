/**
 * Check if file is eligible for Generate command.
 * Eligible: noteKind is undefined or "DictEntry"
 */

import { err, ok, type Result } from "neverthrow";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import {
	type CommandError,
	CommandErrorKind,
	type CommandPayload,
	DICT_ENTRY_NOTE_KIND,
	EligibilitySchema,
} from "../../types";

/**
 * Verifies file is eligible for generation.
 * File must have noteKind undefined or DictEntry.
 */
export function checkEligibility(
	ctx: CommandPayload,
): Result<CommandPayload, CommandError> {
	const metadata = noteMetadataHelper.read(ctx.content, EligibilitySchema);
	const noteKind = metadata?.noteKind;

	// Eligible if no noteKind or already DictEntry
	if (noteKind === undefined || noteKind === DICT_ENTRY_NOTE_KIND) {
		return ok(ctx);
	}

	return err({
		kind: CommandErrorKind.NotEligible,
		noteKind,
	});
}
