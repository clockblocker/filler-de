import { describe, expect, it } from "bun:test";
import {
	createInitMode,
	detectRenameMode,
} from "../../../../src/commanders/librarian-old/healing/mode-detector";
import {
	DragInSubtype,
	HealingMode,
	RuntimeSubtype,
} from "../../../../src/commanders/librarian-old/types/literals";

const LIBRARY_ROOT = "Library";

describe("detectRenameMode", () => {
	describe("DragIn mode", () => {
		it("detects file drag-in from outside library", () => {
			const result = detectRenameMode(
				{
					isFolder: false,
					newPath: "Library/note.md",
					oldPath: "outside/note.md",
				},
				LIBRARY_ROOT,
			);
			expect(result).toEqual({
				mode: HealingMode.DragIn,
				subtype: DragInSubtype.File,
			});
		});

		it("detects folder drag-in from outside library", () => {
			const result = detectRenameMode(
				{
					isFolder: true,
					newPath: "Library/folder",
					oldPath: "outside/folder",
				},
				LIBRARY_ROOT,
			);
			expect(result).toEqual({
				mode: HealingMode.DragIn,
				subtype: DragInSubtype.Folder,
			});
		});

		it("detects drag-in to nested path", () => {
			const result = detectRenameMode(
				{
					isFolder: false,
					newPath: "Library/A/B/doc.pdf",
					oldPath: "Downloads/doc.pdf",
				},
				LIBRARY_ROOT,
			);
			expect(result).toEqual({
				mode: HealingMode.DragIn,
				subtype: DragInSubtype.File,
			});
		});
	});

	describe("Runtime mode - BasenameOnly", () => {
		it("detects basename-only change", () => {
			const result = detectRenameMode(
				{
					isFolder: false,
					newPath: "Library/A/note-B-A.md",
					oldPath: "Library/A/note-A.md",
				},
				LIBRARY_ROOT,
			);
			expect(result).toEqual({
				mode: HealingMode.Runtime,
				subtype: RuntimeSubtype.BasenameOnly,
			});
		});

		it("detects folder rename (basename-only)", () => {
			const result = detectRenameMode(
				{
					isFolder: true,
					newPath: "Library/A/newname",
					oldPath: "Library/A/oldname",
				},
				LIBRARY_ROOT,
			);
			expect(result).toEqual({
				mode: HealingMode.Runtime,
				subtype: RuntimeSubtype.BasenameOnly,
			});
		});
	});

	describe("Runtime mode - PathOnly", () => {
		it("detects path-only change (file moved)", () => {
			const result = detectRenameMode(
				{
					isFolder: false,
					newPath: "Library/B/note.md",
					oldPath: "Library/A/note.md",
				},
				LIBRARY_ROOT,
			);
			expect(result).toEqual({
				mode: HealingMode.Runtime,
				subtype: RuntimeSubtype.PathOnly,
			});
		});

		it("detects folder moved to different parent", () => {
			const result = detectRenameMode(
				{
					isFolder: true,
					newPath: "Library/B/folder",
					oldPath: "Library/A/folder",
				},
				LIBRARY_ROOT,
			);
			expect(result).toEqual({
				mode: HealingMode.Runtime,
				subtype: RuntimeSubtype.PathOnly,
			});
		});

		it("detects file moved deeper", () => {
			const result = detectRenameMode(
				{
					isFolder: false,
					newPath: "Library/A/B/note.md",
					oldPath: "Library/note.md",
				},
				LIBRARY_ROOT,
			);
			expect(result).toEqual({
				mode: HealingMode.Runtime,
				subtype: RuntimeSubtype.PathOnly,
			});
		});
	});

	describe("Runtime mode - Both", () => {
		it("detects both basename and path changed", () => {
			const result = detectRenameMode(
				{
					isFolder: false,
					newPath: "Library/B/new.md",
					oldPath: "Library/A/old.md",
				},
				LIBRARY_ROOT,
			);
			expect(result).toEqual({
				mode: HealingMode.Runtime,
				subtype: RuntimeSubtype.Both,
			});
		});
	});

	describe("null cases", () => {
		it("returns null when moved out of library", () => {
			const result = detectRenameMode(
				{
					isFolder: false,
					newPath: "outside/note.md",
					oldPath: "Library/note.md",
				},
				LIBRARY_ROOT,
			);
			expect(result).toBeNull();
		});

		it("returns null when both paths outside library", () => {
			const result = detectRenameMode(
				{
					isFolder: false,
					newPath: "elsewhere/b.md",
					oldPath: "outside/a.md",
				},
				LIBRARY_ROOT,
			);
			expect(result).toBeNull();
		});

		it("returns null when nothing changed", () => {
			const result = detectRenameMode(
				{
					isFolder: false,
					newPath: "Library/note.md",
					oldPath: "Library/note.md",
				},
				LIBRARY_ROOT,
			);
			expect(result).toBeNull();
		});
	});
});

describe("createInitMode", () => {
	it("creates Init mode event", () => {
		expect(createInitMode()).toEqual({ mode: HealingMode.Init });
	});
});
