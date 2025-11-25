import { describe, expect, it } from "bun:test";
import { LibraryTree } from "../../../src/commanders/librarian/library-tree/library-tree";
import type { TextDto, TreePath } from "../../../src/commanders/librarian/types";
import { TextStatus } from "../../../src/types/common-interface/enums";

describe("LibraryTree.snapshot", () => {
	it("should return empty snapshot for empty tree", () => {
		const tree = new LibraryTree([], "Library");

		const snapshot = tree.snapshot();

		expect(snapshot.texts).toEqual([]);
		expect(snapshot.sectionPaths).toEqual([]);
	});

	it("should capture all texts", () => {
		const texts: TextDto[] = [
			{
				pageStatuses: { "000": TextStatus.Done },
				path: ["Section", "Text1"] as TreePath,
			},
			{
				pageStatuses: { "000": TextStatus.NotStarted },
				path: ["Section", "Text2"] as TreePath,
			},
		];

		const tree = new LibraryTree(texts, "Library");

		const snapshot = tree.snapshot();

		expect(snapshot.texts.length).toBe(2);
	});

	it("should capture all section paths", () => {
		const texts: TextDto[] = [
			{
				pageStatuses: { "000": TextStatus.Done },
				path: ["A", "B", "Text1"] as TreePath,
			},
			{
				pageStatuses: { "000": TextStatus.NotStarted },
				path: ["A", "C", "Text2"] as TreePath,
			},
		];

		const tree = new LibraryTree(texts, "Library");

		const snapshot = tree.snapshot();

		// Should have: A, A/B, A/C
		expect(snapshot.sectionPaths.length).toBe(3);
		expect(snapshot.sectionPaths.some((p) => p.join("/") === "A")).toBe(true);
		expect(snapshot.sectionPaths.some((p) => p.join("/") === "A/B")).toBe(true);
		expect(snapshot.sectionPaths.some((p) => p.join("/") === "A/C")).toBe(true);
	});

	it("should capture nested sections", () => {
		const texts: TextDto[] = [
			{
				pageStatuses: { "000": TextStatus.Done },
				path: ["A", "B", "C", "D", "Text"] as TreePath,
			},
		];

		const tree = new LibraryTree(texts, "Library");

		const snapshot = tree.snapshot();

		// Should have: A, A/B, A/B/C, A/B/C/D
		expect(snapshot.sectionPaths.length).toBe(4);
	});

	it("should reflect mutations in subsequent snapshots", () => {
		const tree = new LibraryTree([], "Library");

		const before = tree.snapshot();

		tree.addTexts([
			{
				pageStatuses: { "000": TextStatus.NotStarted },
				path: ["Section", "NewText"] as TreePath,
			},
		]);

		const after = tree.snapshot();

		expect(before.texts.length).toBe(0);
		expect(after.texts.length).toBe(1);
		expect(before.sectionPaths.length).toBe(0);
		expect(after.sectionPaths.length).toBe(1);
	});
});

describe("LibraryTree.getAllSectionPaths", () => {
	it("should return empty array for tree with no sections", () => {
		const tree = new LibraryTree([], "Library");

		const paths = tree.getAllSectionPaths();

		expect(paths).toEqual([]);
	});

	it("should return all section paths excluding root", () => {
		const texts: TextDto[] = [
			{
				pageStatuses: { "000": TextStatus.Done },
				path: ["A", "Text"] as TreePath,
			},
		];

		const tree = new LibraryTree(texts, "Library");

		const paths = tree.getAllSectionPaths();

		expect(paths.length).toBe(1);
		expect(paths[0]).toEqual(["A"]);
	});

	it("should handle deeply nested sections", () => {
		const texts: TextDto[] = [
			{
				pageStatuses: { "000": TextStatus.Done },
				path: ["Level1", "Level2", "Level3", "Text"] as TreePath,
			},
		];

		const tree = new LibraryTree(texts, "Library");

		const paths = tree.getAllSectionPaths();

		expect(paths.length).toBe(3);
		// Paths should be in DFS order
		const pathStrings = paths.map((p) => p.join("/"));
		expect(pathStrings).toContain("Level1");
		expect(pathStrings).toContain("Level1/Level2");
		expect(pathStrings).toContain("Level1/Level2/Level3");
	});
});

