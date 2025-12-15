import { describe, expect, it } from "bun:test";
import {
	type NoteSnapshotLegacy,
	noteDiffer,
} from "../../../../src/commanders/librarian/diffing/note-differ";
import type { TreePathLegacyLegacy } from "../../../../src/commanders/librarian/types";
import { TextStatusLegacy } from "../../../../src/types/common-interface/enums";

const differ = noteDiffer;

describe("NoteDiffer", () => {
	describe("diff - notes", () => {
		it("should detect added note", () => {
			const before: NoteSnapshotLegacy = {
				notes: [],
				sectionPaths: [],
			};

			const after: NoteSnapshotLegacy = {
				notes: [
					{
						path: ["Section", "NewNote"] as TreePathLegacyLegacy,
						status: TextStatusLegacy.NotStarted,
					},
				],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.addedNotes.length).toBe(1);
			expect(diff.addedNotes[0]?.path).toEqual(["Section", "NewNote"]);
			expect(diff.removedNotes.length).toBe(0);
		});

		it("should detect removed note", () => {
			const before: NoteSnapshotLegacy = {
				notes: [
					{
						path: ["Section", "OldNote"] as TreePathLegacyLegacy,
						status: TextStatusLegacy.Done,
					},
				],
				sectionPaths: [],
			};

			const after: NoteSnapshotLegacy = {
				notes: [],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.removedNotes.length).toBe(1);
			expect(diff.removedNotes[0]?.path).toEqual(["Section", "OldNote"]);
			expect(diff.addedNotes.length).toBe(0);
		});

		it("should detect multiple added and removed notes", () => {
			const before: NoteSnapshotLegacy = {
				notes: [
					{ path: ["A", "Note1"] as TreePathLegacyLegacy, status: TextStatusLegacy.Done },
					{ path: ["A", "Note2"] as TreePathLegacyLegacy, status: TextStatusLegacy.Done },
				],
				sectionPaths: [],
			};

			const after: NoteSnapshotLegacy = {
				notes: [
					{ path: ["A", "Note2"] as TreePathLegacyLegacy, status: TextStatusLegacy.Done },
					{ path: ["A", "Note3"] as TreePathLegacyLegacy, status: TextStatusLegacy.NotStarted },
				],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.addedNotes.length).toBe(1);
			expect(diff.addedNotes[0]?.path).toEqual(["A", "Note3"]);
			expect(diff.removedNotes.length).toBe(1);
			expect(diff.removedNotes[0]?.path).toEqual(["A", "Note1"]);
		});
	});

	describe("diff - status changes", () => {
		it("should detect note status change", () => {
			const before: NoteSnapshotLegacy = {
				notes: [
					{
						path: ["Section", "Note"] as TreePathLegacyLegacy,
						status: TextStatusLegacy.NotStarted,
					},
				],
				sectionPaths: [],
			};

			const after: NoteSnapshotLegacy = {
				notes: [
					{
						path: ["Section", "Note"] as TreePathLegacyLegacy,
						status: TextStatusLegacy.Done,
					},
				],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.statusChanges.length).toBe(1);
			expect(diff.statusChanges[0]?.path).toEqual(["Section", "Note"]);
			expect(diff.statusChanges[0]?.oldStatus).toBe(TextStatusLegacy.NotStarted);
			expect(diff.statusChanges[0]?.newStatus).toBe(TextStatusLegacy.Done);
		});

		it("should detect multiple status changes", () => {
			const before: NoteSnapshotLegacy = {
				notes: [
					{ path: ["Book", "000"] as TreePathLegacyLegacy, status: TextStatusLegacy.NotStarted },
					{ path: ["Book", "001"] as TreePathLegacyLegacy, status: TextStatusLegacy.NotStarted },
				],
				sectionPaths: [],
			};

			const after: NoteSnapshotLegacy = {
				notes: [
					{ path: ["Book", "000"] as TreePathLegacyLegacy, status: TextStatusLegacy.Done },
					{ path: ["Book", "001"] as TreePathLegacyLegacy, status: TextStatusLegacy.Done },
				],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.statusChanges.length).toBe(2);
		});

		it("should not report status change if status unchanged", () => {
			const before: NoteSnapshotLegacy = {
				notes: [
					{ path: ["Section", "Note"] as TreePathLegacyLegacy, status: TextStatusLegacy.Done },
				],
				sectionPaths: [],
			};

			const after: NoteSnapshotLegacy = {
				notes: [
					{ path: ["Section", "Note"] as TreePathLegacyLegacy, status: TextStatusLegacy.Done },
				],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.statusChanges.length).toBe(0);
		});
	});

	describe("diff - sections", () => {
		it("should detect added section", () => {
			const before: NoteSnapshotLegacy = {
				notes: [],
				sectionPaths: [],
			};

			const after: NoteSnapshotLegacy = {
				notes: [],
				sectionPaths: [["NewSection"] as TreePathLegacyLegacy],
			};

			const diff = differ.diff(before, after);

			expect(diff.addedSections.length).toBe(1);
			expect(diff.addedSections[0]).toEqual(["NewSection"]);
		});

		it("should detect removed section", () => {
			const before: NoteSnapshotLegacy = {
				notes: [],
				sectionPaths: [["OldSection"] as TreePathLegacyLegacy],
			};

			const after: NoteSnapshotLegacy = {
				notes: [],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.removedSections.length).toBe(1);
			expect(diff.removedSections[0]).toEqual(["OldSection"]);
		});
	});

	describe("diff - empty cases", () => {
		it("should return empty diff for identical snapshots", () => {
			const snapshot: NoteSnapshotLegacy = {
				notes: [
					{ path: ["A", "Note"] as TreePathLegacyLegacy, status: TextStatusLegacy.Done },
				],
				sectionPaths: [["A"] as TreePathLegacyLegacy],
			};

			const diff = differ.diff(snapshot, snapshot);

			expect(diff.addedNotes.length).toBe(0);
			expect(diff.removedNotes.length).toBe(0);
			expect(diff.addedSections.length).toBe(0);
			expect(diff.removedSections.length).toBe(0);
			expect(diff.statusChanges.length).toBe(0);
		});
	});

	describe("NoteDtoLegacy status change", () => {
		it("NoteDtoLegacy status change is direct", () => {
			const before: NoteSnapshotLegacy = {
				notes: [
					{ path: ["Section", "Book", "000"] as TreePathLegacyLegacy, status: TextStatusLegacy.NotStarted },
				],
				sectionPaths: [],
			};

			const after: NoteSnapshotLegacy = {
				notes: [
					{ path: ["Section", "Book", "000"] as TreePathLegacyLegacy, status: TextStatusLegacy.Done },
				],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			// Path is exactly the note path - no reconstruction needed
			expect(diff.statusChanges[0]?.path).toEqual(["Section", "Book", "000"]);
		});

		it("scroll status change has same path structure as note", () => {
			const before: NoteSnapshotLegacy = {
				notes: [
					{ path: ["Section", "Scroll"] as TreePathLegacyLegacy, status: TextStatusLegacy.NotStarted },
				],
				sectionPaths: [],
			};

			const after: NoteSnapshotLegacy = {
				notes: [
					{ path: ["Section", "Scroll"] as TreePathLegacyLegacy, status: TextStatusLegacy.Done },
				],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.statusChanges[0]?.path).toEqual(["Section", "Scroll"]);
		});
	});
});
