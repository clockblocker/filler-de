import { noteMetadataHelper } from "../note-metadata";
import { parse } from "./internal/parse";
import { serialize } from "./internal/serialize";
import type { DictEntry } from "./types";

export type { SerializeResult } from "./internal/serialize";
export type { DictEntry, EntrySection } from "./types";

/**
 * Serialize entries to a string, applying metadata if any entries carry meta.
 * Combines `serialize()` + conditional `noteMetadataHelper.upsert()`.
 */
function serializeToString(entries: DictEntry[]): string {
	const { body, meta } = serialize(entries);
	if (Object.keys(meta).length > 0) {
		return noteMetadataHelper.upsert(meta)(body) as string;
	}
	return body;
}

export const dictNoteHelper = {
	parse,
	serialize,
	serializeToString,
};
