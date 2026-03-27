import { goBackLinkHelper } from "@textfresser/note-addressing/go-back-link";
import {
	type LibraryBasenameParser,
	type LibraryLookupByCoreName,
	parseLinguisticWikilinks,
} from "../linguistic-wikilink";
import { parse } from "./internal/parse";
import type { DictEntryWithLinguisticWikilinks } from "./types";

export type ParseWithLinguisticWikilinksParams = {
	noteText: string;
	lookupInLibraryByCoreName?: LibraryLookupByCoreName;
	parseLibraryBasename?: LibraryBasenameParser;
};

export function parseWithLinguisticWikilinks(
	params: ParseWithLinguisticWikilinksParams,
): DictEntryWithLinguisticWikilinks[] {
	const parsedEntries = parse(params.noteText);

	return parsedEntries.map((entry) => {
		const linguisticWikilinks = entry.sections.flatMap((section) =>
			parseLinguisticWikilinks({
				content: goBackLinkHelper.strip(section.content),
				lookupInLibraryByCoreName: params.lookupInLibraryByCoreName,
				parseLibraryBasename: params.parseLibraryBasename,
				sectionCssKind: section.kind,
			}),
		);

		return {
			...entry,
			linguisticWikilinks,
		};
	});
}
