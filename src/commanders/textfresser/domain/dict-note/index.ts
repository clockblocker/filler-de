import { noteMetadataHelper } from "../../../../stateless-helpers/note-metadata";
import { parse } from "./internal/parse";
import { serialize } from "./internal/serialize";
import type { DictEntry } from "./types";

export type { SerializeResult } from "./internal/serialize";
export type { DictEntry, EntrySection } from "./types";

/**
 * Serialize entries and apply meta via upsert in one step.
 * Used by propagation steps that need `serialize → conditional upsert → body`.
 */
function serializeWithMeta(entries: DictEntry[]): string {
	const { body, meta } = serialize(entries);
	if (Object.keys(meta).length > 0) {
		// noteMetadataHelper.upsert returns Transform (sync in practice)
		return noteMetadataHelper.upsert(meta)(body) as string;
	}
	return body;
}

export const dictNoteHelper = {
	parse,
	serialize,
	serializeWithMeta,
};
