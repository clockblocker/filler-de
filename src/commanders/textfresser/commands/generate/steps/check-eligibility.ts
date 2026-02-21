import { err, ok, type Result } from "neverthrow";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import { DICT_ENTRY_NOTE_KIND } from "../../../common/metadata";
import { dictNoteHelper } from "../../../domain/dict-note";
import { parsePropagationNote } from "../../../domain/propagation";
import {
	type CommandError,
	CommandErrorKind,
	type CommandState,
	EligibilitySchema,
} from "../../types";

function isTextfresserStructuredNote(ctx: CommandState): boolean {
	const content = ctx.commandContext.activeFile.content;
	if (dictNoteHelper.parse(content).length > 0) {
		return true;
	}

	return (
		parsePropagationNote(content, {
			lookupInLibraryByCoreName: ctx.textfresserState.lookupInLibrary,
			parseLibraryBasename: ctx.textfresserState.parseLibraryBasename,
		}).length > 0
	);
}

/** Eligible if noteKind is undefined or DictEntry. */
export function checkEligibility(
	ctx: CommandState,
): Result<CommandState, CommandError> {
	const content = ctx.commandContext.activeFile.content;
	const metadata = noteMetadataHelper.read(content, EligibilitySchema);
	const noteKind = metadata?.noteKind;

	if (
		noteKind === undefined ||
		noteKind === DICT_ENTRY_NOTE_KIND ||
		isTextfresserStructuredNote(ctx)
	) {
		return ok(ctx);
	}

	return err({
		kind: CommandErrorKind.NotEligible,
		reason: `File has noteKind: ${noteKind}`,
	});
}
