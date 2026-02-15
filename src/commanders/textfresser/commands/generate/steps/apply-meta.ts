import { ok, type Result } from "neverthrow";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import { DICT_ENTRY_NOTE_KIND } from "../../../common/metadata";
import type { CommandError, CommandState } from "../../types";

/** Applies noteKind: DictEntry metadata to content. */
export function applyMeta(
	ctx: CommandState,
): Result<CommandState, CommandError> {
	const activeFile = ctx.commandContext.activeFile;
	const transform = noteMetadataHelper.upsert({
		noteKind: DICT_ENTRY_NOTE_KIND,
	});

	const content = transform(activeFile.content) as string;

	return ok({
		...ctx,
		commandContext: {
			...ctx.commandContext,
			activeFile: { ...activeFile, content },
		},
	});
}
