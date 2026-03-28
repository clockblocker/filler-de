import { parse } from "./internal/parse";
import { serialize } from "./internal/serialize";
import { parseWithLinguisticWikilinks } from "./parse-with-linguistic-wikilinks";
export {
	fromLegacyEntrySection,
	fromLegacyDictEntries,
	fromLegacyDictEntry,
} from "../../core/notes/legacy-dict-note-adapter";

export type { SerializeResult } from "./internal/serialize";
export type { ParseWithLinguisticWikilinksParams } from "./parse-with-linguistic-wikilinks";
export type {
	DictEntry,
	DictEntryWithLinguisticWikilinks,
	EntrySection,
} from "./types";

export const dictNoteHelper = {
	parse,
	parseWithLinguisticWikilinks,
	serialize,
};
