import { ok, type Result } from "neverthrow";
import { dictNoteHelper } from "../../../../../stateless-helpers/dict-note";
import type { DictEntry } from "../../../../../stateless-helpers/dict-note/types";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import type { CommandError, CommandState } from "../../types";

/** Serialize the DictEntry into file content and update activeFile. */
export function serializeEntry(
	ctx: CommandState & { dictEntry: DictEntry },
): Result<CommandState, CommandError> {
	const { body, meta } = dictNoteHelper.serialize([ctx.dictEntry]);

	// Apply metadata (merge dict entry meta with existing note meta)
	let content = body;
	if (Object.keys(meta).length > 0) {
		const transform = noteMetadataHelper.upsert(meta);
		content = transform(content) as string;
	}

	return ok({
		...ctx,
		commandContext: {
			...ctx.commandContext,
			activeFile: {
				...ctx.commandContext.activeFile,
				content,
			},
		},
	});
}
