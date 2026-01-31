/**
 * Wrap content in noteKind: DictEntry metadata.
 */

import { ok, type Result } from "neverthrow";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import {
	type CommandError,
	type CommandPayload,
	DICT_ENTRY_NOTE_KIND,
} from "../../types";

/**
 * Applies noteKind: DictEntry metadata to ctx.content.
 * Does not add actions - content replacement is handled by generateCommand.
 */
export function applyMeta(
	ctx: CommandPayload,
): Result<CommandPayload, CommandError> {
	const transform = noteMetadataHelper.upsert({
		noteKind: DICT_ENTRY_NOTE_KIND,
	});
	const content = transform(ctx.content) as string;

	return ok({
		...ctx,
		content,
	});
}
