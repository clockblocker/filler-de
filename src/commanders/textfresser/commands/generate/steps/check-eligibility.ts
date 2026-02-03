import { err, ok, type Result } from "neverthrow";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import { DICT_ENTRY_NOTE_KIND } from "../../../common/metadata";
import {
	type CommandError,
	CommandErrorKind,
	type CommandState,
	EligibilitySchema,
} from "../../types";

/** Eligible if noteKind is undefined or DictEntry. */
export function checkEligibility(
	ctx: CommandState,
): Result<CommandState, CommandError> {
	const metadata = noteMetadataHelper.read(
		ctx.commandContext.activeFile.content,
		EligibilitySchema,
	);
	const noteKind = metadata?.noteKind;

	if (noteKind === undefined || noteKind === DICT_ENTRY_NOTE_KIND) {
		return ok(ctx);
	}

	return err({
		kind: CommandErrorKind.NotEligible,
		reason: `File has noteKind: ${noteKind}`,
	});
}
