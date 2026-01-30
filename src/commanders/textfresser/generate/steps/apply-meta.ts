/**
 * Add noteKind: DictEntry metadata to the file.
 */

import { ok, type Result } from "neverthrow";
import { VaultActionKind } from "../../../../managers/obsidian/vault-action-manager/types/vault-action";
import { noteMetadataHelper } from "../../../../stateless-helpers/note-metadata";
import {
	DICT_ENTRY_NOTE_KIND,
	type GenerateContext,
	type GenerateError,
} from "../types";

/**
 * Appends ProcessMdFile action to set noteKind: DictEntry.
 */
export function applyMeta(
	ctx: GenerateContext,
): Result<GenerateContext, GenerateError> {
	const action = {
		kind: VaultActionKind.ProcessMdFile,
		payload: {
			splitPath: ctx.splitPath,
			transform: noteMetadataHelper.upsert({ noteKind: DICT_ENTRY_NOTE_KIND }),
		},
	} as const;

	return ok({
		...ctx,
		actions: [...ctx.actions, action],
	});
}
