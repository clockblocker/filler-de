import { buildSectionMarker } from "../../domain/dict-note/internal/constants";
import type {
	DictEntry as LegacyDictEntry,
	EntrySection as LegacyEntrySection,
} from "../../domain/dict-note/types";
import {
	findSectionSpecByMarker,
	type LanguagePack,
} from "../contracts/language-pack";
import type { NoteEntry, NoteSection } from "./types";

function toCanonicalSection(
	section: LegacyEntrySection,
	pack: LanguagePack,
	occurrence: number,
): NoteSection {
	const spec = findSectionSpecByMarker(pack, section.kind);
	if (
		spec &&
		spec.claimPolicy.canClaim({
			content: section.content,
			marker: section.kind,
			occurrence,
			title: section.title,
		})
	) {
		return {
			content: section.content,
			key: spec.key,
			kind: "typed",
			marker: section.kind,
			title: section.title,
		};
	}

	return {
		kind: "raw",
		key: spec?.key,
		marker: section.kind,
		rawBlock: `${buildSectionMarker(section.kind, section.title)}\n${section.content}`,
		title: section.title,
	};
}

export function fromLegacyDictEntry(
	entry: LegacyDictEntry,
	pack: LanguagePack,
): NoteEntry {
	const occurrenceByMarker = new Map<string, number>();
	return {
		headerContent: entry.headerContent,
		id: entry.id,
		meta: entry.meta,
		sections: entry.sections.map((section) => {
			const occurrence = occurrenceByMarker.get(section.kind) ?? 0;
			occurrenceByMarker.set(section.kind, occurrence + 1);
			return toCanonicalSection(section, pack, occurrence);
		}),
	};
}

export function fromLegacyDictEntries(
	entries: readonly LegacyDictEntry[],
	pack: LanguagePack,
): NoteEntry[] {
	return entries.map((entry) => fromLegacyDictEntry(entry, pack));
}
