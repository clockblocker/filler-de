import { parse } from "./internal/parse";
import { parseWithLinguisticWikilinks } from "./parse-with-linguistic-wikilinks";
import { serialize } from "./internal/serialize";

export type { SerializeResult } from "./internal/serialize";
export type {
	DictEntry,
	DictEntryWithLinguisticWikilinks,
	EntrySection,
} from "./types";
export type { ParseWithLinguisticWikilinksParams } from "./parse-with-linguistic-wikilinks";

export const dictNoteHelper = {
	parse,
	parseWithLinguisticWikilinks,
	serialize,
};
