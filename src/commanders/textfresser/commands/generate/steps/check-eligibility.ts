import { err, ok, type Result } from "neverthrow";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import { DICT_ENTRY_NOTE_KIND } from "../../../common/metadata";
import { dictNoteHelper } from "../../../domain/dict-note";
import { ENTRY_SECTION_CSS_CLASS } from "../../../domain/dict-note/internal/constants";
import {
	type CommandError,
	CommandErrorKind,
	type CommandState,
	EligibilitySchema,
} from "../../types";

function isTextfresserStructuredNote(content: string): boolean {
	if (dictNoteHelper.parse(content).length > 0) {
		return true;
	}

	return content.includes(
		`<span class="${ENTRY_SECTION_CSS_CLASS} ${ENTRY_SECTION_CSS_CLASS}_`,
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
		isTextfresserStructuredNote(content)
	) {
		return ok(ctx);
	}

	return err({
		kind: CommandErrorKind.NotEligible,
		reason: `File has noteKind: ${noteKind}`,
	});
}
