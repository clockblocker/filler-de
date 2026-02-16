import { compareSectionsByWeight } from "../../targets/de/sections/section-config";
import { dictNoteHelper } from "../../domain/dict-note";
import type { DictEntry } from "../../domain/dict-note/types";
import { noteMetadataHelper } from "../../../../stateless-helpers/note-metadata";
import { DICT_ENTRY_NOTE_KIND } from "../metadata";

const ATTESTATION_CSS_KIND = "kontexte";

/**
 * Normalize attestation section content: ensure each embed ref is separated by a blank line.
 * Returns true if any content was changed.
 */
function normalizeAttestationSpacing(entry: DictEntry): boolean {
	let changed = false;
	for (const section of entry.sections) {
		if (section.kind !== ATTESTATION_CSS_KIND) continue;
		// Normalize: split on newlines, filter blanks, rejoin with \n\n
		const lines = section.content
			.split("\n")
			.filter((line) => line.trim() !== "");
		const normalized = lines.join("\n\n");
		if (normalized !== section.content) {
			section.content = normalized;
			changed = true;
		}
	}
	return changed;
}

/**
 * Reorder sections within an entry according to SECTION_DISPLAY_WEIGHT.
 * Returns true if the order changed.
 */
function reorderSections(entry: DictEntry): boolean {
	const sorted = [...entry.sections].sort(compareSectionsByWeight);
	const changed = sorted.some((s, i) => s.kind !== entry.sections[i]?.kind);
	if (changed) entry.sections = sorted;
	return changed;
}

/**
 * Check if entries need reordering: LM entries first, IN entries last.
 * Returns true if current order differs from desired order.
 */
function needsReorder(entries: DictEntry[]): boolean {
	const lmEntries = entries.filter((e) => !e.id.includes("-IN-"));
	const inEntries = entries.filter((e) => e.id.includes("-IN-"));
	const desired = [...lmEntries, ...inEntries];
	return entries.some((e, i) => e.id !== desired[i]?.id);
}

/**
 * Cleanup a dict note: reorder entries (LM first, IN last) and normalize attestation spacing.
 * Returns new content if changes were made, or null if no changes needed.
 */
export function cleanupDictNote(content: string): string | null {
	const entries = dictNoteHelper.parse(content);
	if (entries.length === 0) return null;

	let changed = false;

	for (const entry of entries) {
		if (normalizeAttestationSpacing(entry)) changed = true;
		if (reorderSections(entry)) changed = true;
	}

	// Reorder: LM entries first, IN entries last
	if (needsReorder(entries)) {
		const lmEntries = entries.filter((e) => !e.id.includes("-IN-"));
		const inEntries = entries.filter((e) => e.id.includes("-IN-"));
		entries.length = 0;
		entries.push(...lmEntries, ...inEntries);
		changed = true;
	}

	if (!changed) return null;

	const { body, meta } = dictNoteHelper.serialize(entries);
	const fullMeta = { ...meta, noteKind: DICT_ENTRY_NOTE_KIND };
	const transform = noteMetadataHelper.upsert(fullMeta);
	return transform(body) as string;
}
