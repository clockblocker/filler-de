import { ok, type Result } from "neverthrow";
import { noteMetadataHelper } from "../../../../../stateless-helpers/note-metadata";
import { DICT_ENTRY_NOTE_KIND } from "../../../common/metadata";
import type {
	CommandError,
	CommandState,
	TextfresserCommandKind,
} from "../../types";

type Generate = typeof TextfresserCommandKind.Generate;

/** Applies noteKind: DictEntry metadata to content. */
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
