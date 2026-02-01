/**
 * Wrap content in noteKind: DictEntry metadata.
 */

import { ok, type Result } from "neverthrow";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import {
	type CommandError,
	type CommandState,
	DICT_ENTRY_NOTE_KIND,
	type TextfresserCommandKind,
} from "../../types";

type Generate = typeof TextfresserCommandKind.Generate;

/**
 * Applies noteKind: DictEntry metadata to ctx.content.
 * Does not add actions - content replacement is handled by generateCommand.
 */
export function applyMeta(
	ctx: CommandState<Generate>,
): Result<CommandState<Generate>, CommandError> {
	const transform = noteMetadataHelper.upsert({
		noteKind: DICT_ENTRY_NOTE_KIND,
	});
	const content = transform(ctx.currentFileInfo.content) as string;

	return ok({
		...ctx,
		currentFileInfo: { ...ctx.currentFileInfo, content },
	});
}
