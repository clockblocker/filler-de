import { ok, type Result } from "neverthrow";
import { dictNoteHelper } from "../../../../../stateless-helpers/dict-note";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import type { CommandError, CommandState } from "../../types";
import type { GenerateSectionsResult } from "./generate-sections";

/** Serialize all DictEntries into file content and update activeFile. */
export function serializeEntry(
	ctx: GenerateSectionsResult,
): Result<CommandState, CommandError> {
	const { body, meta } = dictNoteHelper.serialize(ctx.allEntries);

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
