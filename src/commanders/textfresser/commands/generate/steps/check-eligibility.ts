/**
 * Check if file is eligible for Generate command.
 * Eligible: noteKind is undefined or "DictEntry"
 */

import { err, ok, type Result } from "neverthrow";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import {
	type CommandError,
	CommandErrorKind,
	type CommandState,
	DICT_ENTRY_NOTE_KIND,
	EligibilitySchema,
	type TextfresserCommandKind,
} from "../../types";

type Generate = typeof TextfresserCommandKind.Generate;

/**
 * Verifies file is eligible for generation.
 * File must have noteKind undefined or DictEntry.
 */
export function checkEligibility(
	ctx: CommandState<Generate>,
): Result<CommandState<Generate>, CommandError> {
	const metadata = noteMetadataHelper.read(
		ctx.currentFileInfo.content,
		EligibilitySchema,
	);
	const noteKind = metadata?.noteKind;

	// Eligible if no noteKind or already DictEntry
	if (noteKind === undefined || noteKind === DICT_ENTRY_NOTE_KIND) {
		return ok(ctx);
	}

	return err({
		kind: CommandErrorKind.NotEligible,
		reason: `File has noteKind: ${noteKind}`,
	});
}
