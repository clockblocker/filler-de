import { goBackLinkHelper } from "@textfresser/note-addressing/go-back-link";
import type { LinguisticWikilinkDto } from "../../../domain/linguistic-wikilink";
import { parseLinguisticWikilinks } from "../../../domain/linguistic-wikilink";
import type {
	LibraryBasenameParser,
	LibraryLookupByCoreName,
} from "../../../domain/linguistic-wikilink/types";
import type { EntrySection as LegacyEntrySection } from "../../../domain/dict-note/types";
import { buildSectionMarker } from "../../../domain/dict-note/internal/constants";
import { deLanguagePack } from "../../../languages/de/pack";
import {
	fromLegacyEntrySection,
	fromLegacyDictEntries,
} from "../../../domain/dict-note";
import { createNoteCodec } from "../../../core/notes/note-codec";
import type { NoteEntry, NoteSection } from "../../../core/notes/types";

const noteCodec = createNoteCodec(deLanguagePack);

export type GenerateMatchableNoteEntry = NoteEntry & {
	linguisticWikilinks: LinguisticWikilinkDto[];
};

function normalizeSectionBody(text: string): string {
	return text
		.trim()
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n");
}

function sectionMarker(section: NoteSection): string | undefined {
	if (section.kind === "typed") {
		return section.marker;
	}
	return section.marker;
}

function sectionWeight(section: NoteSection): number {
	const marker = sectionMarker(section);
	if (!marker) {
		return Number.POSITIVE_INFINITY;
	}
	return deLanguagePack.getSectionByMarker(marker)?.order ?? 99;
}

export function parseGenerateEntries(params: {
	noteText: string;
	lookupInLibraryByCoreName?: LibraryLookupByCoreName;
	parseLibraryBasename?: LibraryBasenameParser;
}): GenerateMatchableNoteEntry[] {
	return noteCodec.parse(params.noteText).map((entry) => ({
		...entry,
		linguisticWikilinks: extractLinguisticWikilinks(entry, params),
	}));
}

function extractLinguisticWikilinks(
	entry: NoteEntry,
	params: {
		lookupInLibraryByCoreName?: LibraryLookupByCoreName;
		parseLibraryBasename?: LibraryBasenameParser;
	},
): LinguisticWikilinkDto[] {
	return entry.sections.flatMap((section) => {
		const marker = sectionMarker(section);
		const content = getSectionContent(section);
		if (!marker || content === null) {
			return [];
		}
		return parseLinguisticWikilinks({
			content: goBackLinkHelper.strip(content),
			lookupInLibraryByCoreName: params.lookupInLibraryByCoreName,
			parseLibraryBasename: params.parseLibraryBasename,
			sectionCssKind: marker,
		});
	});
}

export function getSectionContent(section: NoteSection): string | null {
	if (section.kind === "typed") {
		return section.content;
	}
	if (!section.marker || !section.title) {
		return null;
	}
	const markerText = buildSectionMarker(section.marker, section.title);
	if (!section.rawBlock.startsWith(markerText)) {
		return null;
	}
	return normalizeSectionBody(section.rawBlock.slice(markerText.length));
}

export function setSectionContent(
	section: NoteSection,
	content: string,
): NoteSection {
	if (section.kind === "typed") {
		section.content = content;
		return section;
	}
	if (!section.marker || !section.title) {
		throw new Error("Cannot update content for raw section without marker/title");
	}
	section.rawBlock = `${buildSectionMarker(section.marker, section.title)}\n${content}`;
	return section;
}

export function findFirstSectionByMarker(
	entry: NoteEntry,
	marker: string,
): NoteSection | undefined {
	return entry.sections.find((section) => sectionMarker(section) === marker);
}

export function hasSectionWithMarker(
	entry: NoteEntry,
	marker: string,
): boolean {
	return findFirstSectionByMarker(entry, marker) !== undefined;
}

export function insertSectionByOrder(
	entry: NoteEntry,
	section: NoteSection,
): void {
	const targetWeight = sectionWeight(section);
	let insertAt = entry.sections.length;
	let sawStructuredSection = false;

	for (let index = 0; index < entry.sections.length; index += 1) {
		const current = entry.sections[index];
		if (!current) {
			continue;
		}
		const currentMarker = sectionMarker(current);
		if (!currentMarker) {
			continue;
		}
		sawStructuredSection = true;
		if (sectionWeight(current) > targetWeight) {
			insertAt = index;
			break;
		}
	}

	if (!sawStructuredSection) {
		const leadingLooseRawCount = entry.sections.findIndex(
			(current) => sectionMarker(current) !== undefined,
		);
		if (leadingLooseRawCount >= 0) {
			insertAt = leadingLooseRawCount;
		}
	}

	entry.sections.splice(insertAt, 0, section);
}

export function adaptLegacySectionsForEntry(
	entry: NoteEntry,
	sections: readonly LegacyEntrySection[],
): NoteSection[] {
	const occurrenceByMarker = new Map<string, number>();
	for (const existingSection of entry.sections) {
		const marker = sectionMarker(existingSection);
		if (!marker) {
			continue;
		}
		occurrenceByMarker.set(marker, (occurrenceByMarker.get(marker) ?? 0) + 1);
	}

	return sections.map((section) => {
		const occurrence = occurrenceByMarker.get(section.kind) ?? 0;
		occurrenceByMarker.set(section.kind, occurrence + 1);
		return fromLegacyEntrySection(section, deLanguagePack, occurrence);
	});
}

export function adaptLegacyEntries(entries: readonly {
	headerContent: string;
	id: string;
	meta: Record<string, unknown>;
	sections: LegacyEntrySection[];
}[]): NoteEntry[] {
	return fromLegacyDictEntries(entries, deLanguagePack);
}

export function serializeGenerateEntries(entries: NoteEntry[]) {
	return noteCodec.serialize(entries);
}
