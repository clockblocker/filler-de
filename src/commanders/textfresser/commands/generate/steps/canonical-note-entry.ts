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
import type {
	NoteEntry,
	NoteSection,
	TypedNoteSection,
} from "../../../core/notes/types";

const noteCodec = createNoteCodec(deLanguagePack);

export type GenerateMatchableNoteEntry = NoteEntry & {
	linguisticWikilinks: LinguisticWikilinkDto[];
};

function sectionMarker(section: NoteSection): string | undefined {
	if (section.kind === "typed") {
		return section.marker;
	}
	return section.marker;
}

function sectionWeight(section: NoteSection): number {
	if (section.kind !== "typed") {
		return Number.POSITIVE_INFINITY;
	}
	return deLanguagePack.getSectionByMarker(section.marker)?.order ?? 99;
}

function structuredSectionWeight(section: NoteSection): number {
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
		if (section.kind !== "typed") {
			return [];
		}
		return parseLinguisticWikilinks({
			content: goBackLinkHelper.strip(section.content),
			lookupInLibraryByCoreName: params.lookupInLibraryByCoreName,
			parseLibraryBasename: params.parseLibraryBasename,
			sectionCssKind: section.marker,
		});
	});
}

export function getTypedSectionContent(section: TypedNoteSection): string {
	return section.content;
}

export function setTypedSectionContent(
	section: TypedNoteSection,
	content: string,
): TypedNoteSection {
	section.content = content;
	return section;
}

export function findFirstTypedSectionByMarker(
	entry: NoteEntry,
	marker: string,
): TypedNoteSection | undefined {
	return entry.sections.find(
		(section): section is TypedNoteSection =>
			section.kind === "typed" && section.marker === marker,
	);
}

export function hasTypedSectionWithMarker(
	entry: NoteEntry,
	marker: string,
): boolean {
	return findFirstTypedSectionByMarker(entry, marker) !== undefined;
}

export function insertSectionByOrder(
	entry: NoteEntry,
	section: NoteSection,
): void {
	const targetWeight = sectionWeight(section);
	let trailingLooseRawStart = entry.sections.length;
	for (let index = entry.sections.length - 1; index >= 0; index -= 1) {
		const current = entry.sections[index];
		if (!current || sectionMarker(current) !== undefined) {
			break;
		}
		trailingLooseRawStart = index;
	}

	let insertAt = trailingLooseRawStart;
	let sawTypedSection = false;

	for (let index = 0; index < trailingLooseRawStart; index += 1) {
		const current = entry.sections[index];
		if (!current || current.kind !== "typed") {
			continue;
		}
		sawTypedSection = true;
		if (sectionWeight(current) > targetWeight) {
			insertAt = index;
			break;
		}
	}

	if (!sawTypedSection) {
		const firstStructuredIndex = entry.sections.findIndex(
			(current) => sectionMarker(current) !== undefined,
		);
		if (firstStructuredIndex >= 0) {
			insertAt = firstStructuredIndex;
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

export function orderGenerateEntrySections(entry: NoteEntry): void {
	let prefixEnd = 0;
	while (
		prefixEnd < entry.sections.length &&
		sectionMarker(entry.sections[prefixEnd]!) === undefined
	) {
		prefixEnd += 1;
	}

	let suffixStart = entry.sections.length;
	while (
		suffixStart > prefixEnd &&
		sectionMarker(entry.sections[suffixStart - 1]!) === undefined
	) {
		suffixStart -= 1;
	}

	const prefix = entry.sections.slice(0, prefixEnd);
	const suffix = entry.sections.slice(suffixStart);
	const middle = entry.sections.slice(prefixEnd, suffixStart);

	const units: Array<{
		index: number;
		leadingLooseRaw: NoteSection[];
		section: NoteSection;
	}> = [];
	let pendingLooseRaw: NoteSection[] = [];

	for (const section of middle) {
		if (sectionMarker(section) === undefined) {
			pendingLooseRaw.push(section);
			continue;
		}
		units.push({
			index: units.length,
			leadingLooseRaw: pendingLooseRaw,
			section,
		});
		pendingLooseRaw = [];
	}

	const sortedUnits = [...units].sort((left, right) => {
		const weightDelta =
			structuredSectionWeight(left.section) -
			structuredSectionWeight(right.section);
		if (weightDelta !== 0) {
			return weightDelta;
		}
		return left.index - right.index;
	});

	entry.sections = [
		...prefix,
		...sortedUnits.flatMap((unit) => [...unit.leadingLooseRaw, unit.section]),
		...pendingLooseRaw,
		...suffix,
	];
}

export function serializeGenerateEntries(entries: NoteEntry[]) {
	return noteCodec.serialize(entries);
}
