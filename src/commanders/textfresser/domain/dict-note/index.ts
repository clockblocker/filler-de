import { noteMetadataHelper } from "../../../../stateless-helpers/note-metadata";
import { parse } from "./internal/parse";
import { serialize } from "./internal/serialize";
import type { DictEntry } from "./types";

export type { SerializeResult } from "./internal/serialize";
export type { DictEntry, EntrySection } from "./types";

function serializeToString(entries: DictEntry[]): string {
	const { body, meta } = serialize(entries);
	if (Object.keys(meta).length === 0) {
		return body;
	}

	const withMeta = noteMetadataHelper.upsert(meta)(body);
	if (typeof withMeta !== "string") {
		throw new Error(
			"dictNoteHelper.serializeToString expected synchronous metadata transform",
		);
	}

	return withMeta;
}

export const dictNoteHelper = {
	parse,
	serialize,
	serializeToString,
};
