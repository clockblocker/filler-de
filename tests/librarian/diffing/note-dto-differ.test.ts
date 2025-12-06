import { describe, expect, it } from "bun:test";
import {
	type NoteSnapshot,
	noteDiffer,
} from "../../../src/commanders/librarian/diffing/note-differ";
import type { TreePath } from "../../../src/commanders/librarian/types";
import { TextStatus } from "../../../src/types/common-interface/enums";

const differ = noteDiffer;

describe("NoteDiffer", () => {
	describe("diff - notes", () => {
		it("should detect added note", () => {
			const before: NoteSnapshot = {
				notes: [],
				sectionPaths: [],
			};

			const after: NoteSnapshot = {
				notes: [
					{
						path: ["Section", "NewNote"] as TreePath,
						status: TextStatus.NotStarted,
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
			const before: NoteSnapshot = {
				notes: [
					{
						path: ["Section", "OldNote"] as TreePath,
						status: TextStatus.Done,
					},
				],
				sectionPaths: [],
			};

			const after: NoteSnapshot = {
				notes: [],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.removedNotes.length).toBe(1);
			expect(diff.removedNotes[0]?.path).toEqual(["Section", "OldNote"]);
			expect(diff.addedNotes.length).toBe(0);
		});

		it("should detect multiple added and removed notes", () => {
			const before: NoteSnapshot = {
				notes: [
					{ path: ["A", "Note1"] as TreePath, status: TextStatus.Done },
					{ path: ["A", "Note2"] as TreePath, status: TextStatus.Done },
				],
				sectionPaths: [],
			};

			const after: NoteSnapshot = {
				notes: [
					{ path: ["A", "Note2"] as TreePath, status: TextStatus.Done },
					{ path: ["A", "Note3"] as TreePath, status: TextStatus.NotStarted },
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
			const before: NoteSnapshot = {
				notes: [
					{
						path: ["Section", "Note"] as TreePath,
						status: TextStatus.NotStarted,
					},
				],
				sectionPaths: [],
			};

			const after: NoteSnapshot = {
				notes: [
					{
						path: ["Section", "Note"] as TreePath,
						status: TextStatus.Done,
					},
				],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.statusChanges.length).toBe(1);
			expect(diff.statusChanges[0]?.path).toEqual(["Section", "Note"]);
			expect(diff.statusChanges[0]?.oldStatus).toBe(TextStatus.NotStarted);
			expect(diff.statusChanges[0]?.newStatus).toBe(TextStatus.Done);
		});

		it("should detect multiple status changes", () => {
			const before: NoteSnapshot = {
				notes: [
					{ path: ["Book", "000"] as TreePath, status: TextStatus.NotStarted },
					{ path: ["Book", "001"] as TreePath, status: TextStatus.NotStarted },
				],
				sectionPaths: [],
			};

			const after: NoteSnapshot = {
				notes: [
					{ path: ["Book", "000"] as TreePath, status: TextStatus.Done },
					{ path: ["Book", "001"] as TreePath, status: TextStatus.Done },
				],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.statusChanges.length).toBe(2);
		});

		it("should not report status change if status unchanged", () => {
			const before: NoteSnapshot = {
				notes: [
					{ path: ["Section", "Note"] as TreePath, status: TextStatus.Done },
				],
				sectionPaths: [],
			};

			const after: NoteSnapshot = {
				notes: [
					{ path: ["Section", "Note"] as TreePath, status: TextStatus.Done },
				],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.statusChanges.length).toBe(0);
		});
	});

	describe("diff - sections", () => {
		it("should detect added section", () => {
			const before: NoteSnapshot = {
				notes: [],
				sectionPaths: [],
			};

			const after: NoteSnapshot = {
				notes: [],
				sectionPaths: [["NewSection"] as TreePath],
			};

			const diff = differ.diff(before, after);

			expect(diff.addedSections.length).toBe(1);
			expect(diff.addedSections[0]).toEqual(["NewSection"]);
		});

		it("should detect removed section", () => {
			const before: NoteSnapshot = {
				notes: [],
				sectionPaths: [["OldSection"] as TreePath],
			};

			const after: NoteSnapshot = {
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
			const snapshot: NoteSnapshot = {
				notes: [
					{ path: ["A", "Note"] as TreePath, status: TextStatus.Done },
				],
				sectionPaths: [["A"] as TreePath],
			};

			const diff = differ.diff(snapshot, snapshot);

			expect(diff.addedNotes.length).toBe(0);
			expect(diff.removedNotes.length).toBe(0);
			expect(diff.addedSections.length).toBe(0);
			expect(diff.removedSections.length).toBe(0);
			expect(diff.statusChanges.length).toBe(0);
		});
	});

	describe("NoteDto status change", () => {
		it("NoteDto status change is direct", () => {
			const before: NoteSnapshot = {
				notes: [
					{ path: ["Section", "Book", "000"] as TreePath, status: TextStatus.NotStarted },
				],
				sectionPaths: [],
			};

			const after: NoteSnapshot = {
				notes: [
					{ path: ["Section", "Book", "000"] as TreePath, status: TextStatus.Done },
				],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			// Path is exactly the note path - no reconstruction needed
			expect(diff.statusChanges[0]?.path).toEqual(["Section", "Book", "000"]);
		});

		it("scroll status change has same path structure as note", () => {
			const before: NoteSnapshot = {
				notes: [
					{ path: ["Section", "Scroll"] as TreePath, status: TextStatus.NotStarted },
				],
				sectionPaths: [],
			};

			const after: NoteSnapshot = {
				notes: [
					{ path: ["Section", "Scroll"] as TreePath, status: TextStatus.Done },
				],
				sectionPaths: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.statusChanges[0]?.path).toEqual(["Section", "Scroll"]);
		});
	});
});
