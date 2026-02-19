import { noteMetadataHelper } from "../../../../stateless-helpers/note-metadata";
import { dictNoteHelper } from ".";
import type { DictEntry } from "./types";

/**
 * Serialize dict entries to a note body string,
 * including frontmatter metadata when entries carry meta.
 */
export function serializeDictNote(entries: DictEntry[]): string {
	const { body, meta } = dictNoteHelper.serialize(entries);
	if (Object.keys(meta).length > 0) {
		return noteMetadataHelper.upsert(meta)(body) as string;
	}
	return body;
}
