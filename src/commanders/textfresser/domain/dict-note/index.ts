import { parse } from "./internal/parse";
import { serialize } from "./internal/serialize";
import { parseWithLinguisticWikilinks } from "./parse-with-linguistic-wikilinks";
export {
	fromLegacyEntrySection,
	fromLegacyDictEntries,
	fromLegacyDictEntry,
} from "../../core/notes/legacy-dict-note-adapter";

export const dictNoteHelper = {
	parse,
	parseWithLinguisticWikilinks,
	serialize,
};
