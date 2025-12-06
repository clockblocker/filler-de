import { describe, expect, it } from "bun:test";
import { LibraryTreeV2 } from "../../../src/commanders/librarian/library-tree/library-tree-v2";
import {
	NodeTypeV2,
	type NoteDto,
	type TreePath,
} from "../../../src/commanders/librarian/types";
import { TextStatus } from "../../../src/types/common-interface/enums";
import { AVATAR_NOTES } from "../static/batteries/avatar";

describe("LibraryTreeV2", () => {
	describe("Constructor", () => {
		it("should create tree from empty NoteDto array", () => {
			const tree = new LibraryTreeV2([], "Library");

			expect(tree.root.name).toBe("Library");
			expect(tree.root.children.length).toBe(0);
			expect(tree.root.status).toBe(TextStatus.NotStarted);
			expect(tree.root.type).toBe(NodeTypeV2.Section);
		});

		it("should create sections and notes from NoteDto paths", () => {
			const notes: NoteDto[] = [
				{
					path: ["Books", "Fiction", "Chapter1"] as TreePath,
					status: TextStatus.NotStarted,
				},
			];

			const tree = new LibraryTreeV2(notes, "Library");

			const books = tree.getMaybeNode({ path: ["Books"] });
			const fiction = tree.getMaybeNode({ path: ["Books", "Fiction"] });
			const chapter = tree.getMaybeNode({ path: ["Books", "Fiction", "Chapter1"] });

			expect(books.error).toBe(false);
			expect(fiction.error).toBe(false);
			expect(chapter.error).toBe(false);

			if (!chapter.error) {
				expect(chapter.data.type).toBe(NodeTypeV2.Note);
			}
		});

		it("should build tree from AVATAR_NOTES fixture", () => {
			const tree = new LibraryTreeV2([...AVATAR_NOTES], "Library");

			// Check structure
			const avatar = tree.getMaybeSection({ path: ["Avatar"] });
			expect(avatar.error).toBe(false);

			const season1 = tree.getMaybeSection({ path: ["Avatar", "Season_1"] });
			expect(season1.error).toBe(false);

			// Episode_1 is a scroll (note directly in season)
			const ep1 = tree.getMaybeNote({ path: ["Avatar", "Season_1", "Episode_1"] });
			expect(ep1.error).toBe(false);

			// Episode_2 is a book (section with page notes)
			const ep2 = tree.getMaybeSection({ path: ["Avatar", "Season_1", "Episode_2"] });
			expect(ep2.error).toBe(false);

			// Book pages are notes
			const page0 = tree.getMaybeNote({ path: ["Avatar", "Season_1", "Episode_2", "000"] });
			const page1 = tree.getMaybeNote({ path: ["Avatar", "Season_1", "Episode_2", "001"] });
			expect(page0.error).toBe(false);
			expect(page1.error).toBe(false);
		});
	});

	describe("Status computation", () => {
		it("should compute Done status when all notes Done", () => {
			const notes: NoteDto[] = [
				{ path: ["Section", "Note1"] as TreePath, status: TextStatus.Done },
				{ path: ["Section", "Note2"] as TreePath, status: TextStatus.Done },
			];

			const tree = new LibraryTreeV2(notes, "Library");
			const section = tree.getMaybeSection({ path: ["Section"] });

			expect(section.error).toBe(false);
			if (!section.error) {
				expect(section.data.status).toBe(TextStatus.Done);
			}
		});

		it("should compute NotStarted when all notes NotStarted", () => {
			const notes: NoteDto[] = [
				{ path: ["Section", "Note1"] as TreePath, status: TextStatus.NotStarted },
				{ path: ["Section", "Note2"] as TreePath, status: TextStatus.NotStarted },
			];

			const tree = new LibraryTreeV2(notes, "Library");
			const section = tree.getMaybeSection({ path: ["Section"] });

			expect(section.error).toBe(false);
			if (!section.error) {
				expect(section.data.status).toBe(TextStatus.NotStarted);
			}
		});

		it("should compute InProgress when mixed statuses", () => {
			const notes: NoteDto[] = [
				{ path: ["Section", "Note1"] as TreePath, status: TextStatus.Done },
				{ path: ["Section", "Note2"] as TreePath, status: TextStatus.NotStarted },
			];

			const tree = new LibraryTreeV2(notes, "Library");
			const section = tree.getMaybeSection({ path: ["Section"] });

			expect(section.error).toBe(false);
			if (!section.error) {
				expect(section.data.status).toBe(TextStatus.InProgress);
			}
		});

		it("should propagate status up nested sections", () => {
			const notes: NoteDto[] = [
				{ path: ["A", "B", "Note1"] as TreePath, status: TextStatus.Done },
				{ path: ["A", "B", "Note2"] as TreePath, status: TextStatus.Done },
			];

			const tree = new LibraryTreeV2(notes, "Library");

			const a = tree.getMaybeSection({ path: ["A"] });
			const b = tree.getMaybeSection({ path: ["A", "B"] });

			expect(a.error).toBe(false);
			expect(b.error).toBe(false);

			if (!a.error && !b.error) {
				expect(b.data.status).toBe(TextStatus.Done);
				expect(a.data.status).toBe(TextStatus.Done);
			}
		});
	});

	describe("addNotes", () => {
		it("should add notes incrementally", () => {
			const tree = new LibraryTreeV2([], "Library");

			tree.addNotes([
				{ path: ["Section", "Note1"] as TreePath, status: TextStatus.Done },
			]);

			tree.addNotes([
				{ path: ["Section", "Note2"] as TreePath, status: TextStatus.NotStarted },
			]);

			const notes = tree.getAllNotes();
			expect(notes.length).toBe(2);

			const section = tree.getMaybeSection({ path: ["Section"] });
			expect(section.error).toBe(false);
			if (!section.error) {
				expect(section.data.status).toBe(TextStatus.InProgress);
			}
		});

		it("should update existing note status", () => {
			const tree = new LibraryTreeV2(
				[{ path: ["Note"] as TreePath, status: TextStatus.NotStarted }],
				"Library",
			);

			tree.addNotes([{ path: ["Note"] as TreePath, status: TextStatus.Done }]);

			const notes = tree.getAllNotes();
			expect(notes.length).toBe(1);
			expect(notes[0]?.status).toBe(TextStatus.Done);
		});
	});

	describe("deleteNotes", () => {
		it("should delete note", () => {
			const tree = new LibraryTreeV2(
				[
					{ path: ["Section", "Note1"] as TreePath, status: TextStatus.Done },
					{ path: ["Section", "Note2"] as TreePath, status: TextStatus.Done },
				],
				"Library",
			);

			tree.deleteNotes([["Section", "Note1"]]);

			const notes = tree.getAllNotes();
			expect(notes.length).toBe(1);
			expect(notes[0]?.path).toEqual(["Section", "Note2"]);
		});

		it("should cleanup empty sections after delete", () => {
			const tree = new LibraryTreeV2(
				[{ path: ["A", "B", "Note"] as TreePath, status: TextStatus.Done }],
				"Library",
			);

			tree.deleteNotes([["A", "B", "Note"]]);

			// Both A and B should be deleted
			const a = tree.getMaybeNode({ path: ["A"] });
			expect(a.error).toBe(true);
		});

		it("should not cleanup non-empty parent sections", () => {
			const tree = new LibraryTreeV2(
				[
					{ path: ["A", "Note1"] as TreePath, status: TextStatus.Done },
					{ path: ["A", "Note2"] as TreePath, status: TextStatus.Done },
				],
				"Library",
			);

			tree.deleteNotes([["A", "Note1"]]);

			const a = tree.getMaybeSection({ path: ["A"] });
			expect(a.error).toBe(false);
			if (!a.error) {
				expect(a.data.children.length).toBe(1);
			}
		});

		it("should recompute status after delete", () => {
			const tree = new LibraryTreeV2(
				[
					{ path: ["Section", "Note1"] as TreePath, status: TextStatus.Done },
					{ path: ["Section", "Note2"] as TreePath, status: TextStatus.NotStarted },
				],
				"Library",
			);

			// Section is InProgress
			let section = tree.getMaybeSection({ path: ["Section"] });
			expect(!section.error && section.data.status).toBe(TextStatus.InProgress);

			// Delete NotStarted note
			tree.deleteNotes([["Section", "Note2"]]);

			// Section is now Done
			section = tree.getMaybeSection({ path: ["Section"] });
			expect(!section.error && section.data.status).toBe(TextStatus.Done);
		});
	});

	describe("setStatus", () => {
		it("should set note status", () => {
			const tree = new LibraryTreeV2(
				[{ path: ["Note"] as TreePath, status: TextStatus.NotStarted }],
				"Library",
			);

			const result = tree.setStatus({ path: ["Note"], status: "Done" });

			expect(result.error).toBe(false);
			if (!result.error) {
				expect(result.data.status).toBe(TextStatus.Done);
			}
		});

		it("should set section status recursively", () => {
			const tree = new LibraryTreeV2(
				[
					{ path: ["Section", "Note1"] as TreePath, status: TextStatus.NotStarted },
					{ path: ["Section", "Note2"] as TreePath, status: TextStatus.NotStarted },
				],
				"Library",
			);

			tree.setStatus({ path: ["Section"], status: "Done" });

			const notes = tree.getAllNotes();
			expect(notes.every((n) => n.status === TextStatus.Done)).toBe(true);
		});

		it("should return error for non-existent path", () => {
			const tree = new LibraryTreeV2([], "Library");

			const result = tree.setStatus({ path: ["NonExistent"], status: "Done" });

			expect(result.error).toBe(true);
		});

		it("should recompute parent status after setting child", () => {
			const tree = new LibraryTreeV2(
				[
					{ path: ["Section", "Note1"] as TreePath, status: TextStatus.Done },
					{ path: ["Section", "Note2"] as TreePath, status: TextStatus.Done },
				],
				"Library",
			);

			tree.setStatus({ path: ["Section", "Note1"], status: "NotStarted" });

			const section = tree.getMaybeSection({ path: ["Section"] });
			expect(!section.error && section.data.status).toBe(TextStatus.InProgress);
		});
	});

	describe("snapshot", () => {
		it("should return all notes and section paths", () => {
			const tree = new LibraryTreeV2(
				[
					{ path: ["A", "Note1"] as TreePath, status: TextStatus.Done },
					{ path: ["A", "B", "Note2"] as TreePath, status: TextStatus.NotStarted },
				],
				"Library",
			);

			const snapshot = tree.snapshot();

			expect(snapshot.notes.length).toBe(2);
			expect(snapshot.sectionPaths.length).toBe(2); // A and A/B
			expect(snapshot.sectionPaths).toContainEqual(["A"]);
			expect(snapshot.sectionPaths).toContainEqual(["A", "B"]);
		});
	});

	describe("getNearestSection", () => {
		it("should return section for section path", () => {
			const tree = new LibraryTreeV2(
				[{ path: ["A", "B", "Note"] as TreePath, status: TextStatus.Done }],
				"Library",
			);

			const section = tree.getNearestSection(["A", "B"]);
			expect(section.name).toBe("B");
		});

		it("should return parent section for note path", () => {
			const tree = new LibraryTreeV2(
				[{ path: ["A", "Note"] as TreePath, status: TextStatus.Done }],
				"Library",
			);

			const section = tree.getNearestSection(["A", "Note"]);
			expect(section.name).toBe("A");
		});

		it("should return root for invalid path", () => {
			const tree = new LibraryTreeV2([], "Library");

			const section = tree.getNearestSection(["NonExistent"]);
			expect(section.name).toBe("Library");
		});
	});

	describe("V2 vs V1 comparison", () => {
		it("book pages are Notes under Section (not Pages under Text)", () => {
			// V2: Book "Episode_2" is a Section containing Note children
			const tree = new LibraryTreeV2(
				[
					{ path: ["Book", "000"] as TreePath, status: TextStatus.Done },
					{ path: ["Book", "001"] as TreePath, status: TextStatus.NotStarted },
				],
				"Library",
			);

			const book = tree.getMaybeSection({ path: ["Book"] });
			expect(book.error).toBe(false);

			if (!book.error) {
				expect(book.data.type).toBe(NodeTypeV2.Section);
				expect(book.data.children.length).toBe(2);
				expect(book.data.children.every((c) => c.type === NodeTypeV2.Note)).toBe(true);
			}
		});

		it("scroll is Note directly in parent Section", () => {
			// V2: Scroll "Intro" is a Note at root level
			const tree = new LibraryTreeV2(
				[{ path: ["Intro"] as TreePath, status: TextStatus.Done }],
				"Library",
			);

			const intro = tree.getMaybeNote({ path: ["Intro"] });
			expect(intro.error).toBe(false);

			if (!intro.error) {
				expect(intro.data.type).toBe(NodeTypeV2.Note);
				expect(intro.data.parent).toBe(tree.root);
			}
		});

		it("no TextNode intermediate - simpler tree structure", () => {
			const tree = new LibraryTreeV2(
				[
					{ path: ["Section", "Scroll"] as TreePath, status: TextStatus.Done },
					{ path: ["Section", "Book", "000"] as TreePath, status: TextStatus.Done },
				],
				"Library",
			);

			// Section contains: 1 Note (Scroll) + 1 Section (Book)
			const section = tree.getMaybeSection({ path: ["Section"] });
			expect(section.error).toBe(false);

			if (!section.error) {
				const childTypes = section.data.children.map((c) => c.type);
				expect(childTypes).toContain(NodeTypeV2.Note);
				expect(childTypes).toContain(NodeTypeV2.Section);
			}
		});
	});
});
