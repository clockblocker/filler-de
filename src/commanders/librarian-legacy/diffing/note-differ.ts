import type { TextStatusLegacy } from "../../../types/common-interface/enums";
import type { NoteDtoLegacy, TreePathLegacyLegacy } from "../types";

/**
 * Snapshot of tree state for diffing.
 */
export type NoteSnapshotLegacy = {
	notes: NoteDtoLegacy[];
	sectionPaths: TreePathLegacyLegacy[];
};

/**
 * Status change for a single note.
 */
export type NoteStatusChange = {
	newStatus: TextStatusLegacy;
	oldStatus: TextStatusLegacy;
	path: TreePathLegacyLegacy;
};

/**
 * Diff between two NoteSnapshotLegacy.
 */
export type NoteDiff = {
	addedNotes: NoteDtoLegacy[];
	addedSections: TreePathLegacyLegacy[];
	removedNotes: NoteDtoLegacy[];
	removedSections: TreePathLegacyLegacy[];
	statusChanges: NoteStatusChange[];
};

/**
 * Empty diff constant.
 */
export const EMPTY_NOTE_DIFF: NoteDiff = {
	addedNotes: [],
	addedSections: [],
	removedNotes: [],
	removedSections: [],
	statusChanges: [],
};

/**
 * Check if diff has any changes.
 */
export function isNoteDiffEmpty(diff: NoteDiff): boolean {
	return (
		diff.addedNotes.length === 0 &&
		diff.removedNotes.length === 0 &&
		diff.addedSections.length === 0 &&
		diff.removedSections.length === 0 &&
		diff.statusChanges.length === 0
	);
}

export class NoteDiffer {
	diff(before: NoteSnapshotLegacy, after: NoteSnapshotLegacy): NoteDiff {
		const beforeNoteKeys = new Set(
			before.notes.map((n) => n.path.join("/")),
		);
		const afterNoteKeys = new Set(after.notes.map((n) => n.path.join("/")));
		const afterNoteMap = new Map(
			after.notes.map((n) => [n.path.join("/"), n]),
		);

		// Added/removed notes
		const addedNotes = after.notes.filter(
			(n) => !beforeNoteKeys.has(n.path.join("/")),
		);
		const removedNotes = before.notes.filter(
			(n) => !afterNoteKeys.has(n.path.join("/")),
		);

		// Status changes (notes in both, status differs)
		const statusChanges: NoteStatusChange[] = [];
		for (const beforeNote of before.notes) {
			const key = beforeNote.path.join("/");
			const afterNote = afterNoteMap.get(key);
			if (afterNote && beforeNote.status !== afterNote.status) {
				statusChanges.push({
					newStatus: afterNote.status,
					oldStatus: beforeNote.status,
					path: beforeNote.path,
				});
			}
		}

		// Added/removed sections
		const beforeSectionKeys = new Set(
			before.sectionPaths.map((p) => p.join("/")),
		);
		const afterSectionKeys = new Set(
			after.sectionPaths.map((p) => p.join("/")),
		);

		const addedSections = after.sectionPaths.filter(
			(p) => !beforeSectionKeys.has(p.join("/")),
		);
		const removedSections = before.sectionPaths.filter(
			(p) => !afterSectionKeys.has(p.join("/")),
		);

		return {
			addedNotes,
			addedSections,
			removedNotes,
			removedSections,
			statusChanges,
		};
	}
}

/** Singleton instance */
export const noteDiffer = new NoteDiffer();
