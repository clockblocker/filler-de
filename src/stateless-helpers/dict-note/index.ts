import { parse } from "./internal/parse";
import { serialize } from "./internal/serialize";

export type { SerializeResult } from "./internal/serialize";
export type { DictEntry, EntrySection } from "./types";

export const dictNoteHelper = {
	parse,
	serialize,
};
