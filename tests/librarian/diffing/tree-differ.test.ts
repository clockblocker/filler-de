import { describe, expect, it } from "bun:test";
import { TreeDiffer } from "../../../src/commanders/librarian/diffing/tree-differ";
import type { TreeSnapshot } from "../../../src/commanders/librarian/diffing/types";
import type { TextDto, TreePath } from "../../../src/commanders/librarian/types";
import { TextStatus } from "../../../src/types/common-interface/enums";

const differ = new TreeDiffer();

describe("TreeDiffer", () => {
	describe("diff - texts", () => {
		it("should detect added text", () => {
			const before: TreeSnapshot = {
				sectionPaths: [],
				texts: [],
			};

			const after: TreeSnapshot = {
				sectionPaths: [],
				texts: [
					{
						pageStatuses: { "000": TextStatus.NotStarted },
						path: ["Section", "NewText"] as TreePath,
					},
				],
			};

			const diff = differ.diff(before, after);

			expect(diff.addedTexts.length).toBe(1);
			expect(diff.addedTexts[0].path).toEqual(["Section", "NewText"]);
			expect(diff.removedTexts.length).toBe(0);
		});

		it("should detect removed text", () => {
			const before: TreeSnapshot = {
				sectionPaths: [],
				texts: [
					{
						pageStatuses: { "000": TextStatus.Done },
						path: ["Section", "OldText"] as TreePath,
					},
				],
			};

			const after: TreeSnapshot = {
				sectionPaths: [],
				texts: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.removedTexts.length).toBe(1);
			expect(diff.removedTexts[0].path).toEqual(["Section", "OldText"]);
			expect(diff.addedTexts.length).toBe(0);
		});

		it("should detect multiple added and removed texts", () => {
			const before: TreeSnapshot = {
				sectionPaths: [],
				texts: [
					{ pageStatuses: { "000": TextStatus.Done }, path: ["A", "Text1"] as TreePath },
					{ pageStatuses: { "000": TextStatus.Done }, path: ["A", "Text2"] as TreePath },
				],
			};

			const after: TreeSnapshot = {
				sectionPaths: [],
				texts: [
					{ pageStatuses: { "000": TextStatus.Done }, path: ["A", "Text2"] as TreePath },
					{ pageStatuses: { "000": TextStatus.NotStarted }, path: ["A", "Text3"] as TreePath },
				],
			};

			const diff = differ.diff(before, after);

			expect(diff.addedTexts.length).toBe(1);
			expect(diff.addedTexts[0].path).toEqual(["A", "Text3"]);
			expect(diff.removedTexts.length).toBe(1);
			expect(diff.removedTexts[0].path).toEqual(["A", "Text1"]);
		});
	});

	describe("diff - sections", () => {
		it("should detect added section", () => {
			const before: TreeSnapshot = {
				sectionPaths: [],
				texts: [],
			};

			const after: TreeSnapshot = {
				sectionPaths: [["NewSection"] as TreePath],
				texts: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.addedSections.length).toBe(1);
			expect(diff.addedSections[0]).toEqual(["NewSection"]);
		});

		it("should detect removed section", () => {
			const before: TreeSnapshot = {
				sectionPaths: [["OldSection"] as TreePath],
				texts: [],
			};

			const after: TreeSnapshot = {
				sectionPaths: [],
				texts: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.removedSections.length).toBe(1);
			expect(diff.removedSections[0]).toEqual(["OldSection"]);
		});

		it("should detect nested section changes", () => {
			const before: TreeSnapshot = {
				sectionPaths: [
					["A"] as TreePath,
					["A", "B"] as TreePath,
				],
				texts: [],
			};

			const after: TreeSnapshot = {
				sectionPaths: [
					["A"] as TreePath,
					["A", "C"] as TreePath,
				],
				texts: [],
			};

			const diff = differ.diff(before, after);

			expect(diff.addedSections.length).toBe(1);
			expect(diff.addedSections[0]).toEqual(["A", "C"]);
			expect(diff.removedSections.length).toBe(1);
			expect(diff.removedSections[0]).toEqual(["A", "B"]);
		});
	});

	describe("diff - status changes", () => {
		it("should detect page status change", () => {
			const before: TreeSnapshot = {
				sectionPaths: [],
				texts: [
					{
						pageStatuses: { "000": TextStatus.NotStarted },
						path: ["Section", "Text"] as TreePath,
					},
				],
			};

			const after: TreeSnapshot = {
				sectionPaths: [],
				texts: [
					{
						pageStatuses: { "000": TextStatus.Done },
						path: ["Section", "Text"] as TreePath,
					},
				],
			};

			const diff = differ.diff(before, after);

			expect(diff.statusChanges.length).toBe(1);
			expect(diff.statusChanges[0].path).toEqual(["Section", "Text", "000"]);
			expect(diff.statusChanges[0].oldStatus).toBe(TextStatus.NotStarted);
			expect(diff.statusChanges[0].newStatus).toBe(TextStatus.Done);
		});

		it("should detect multiple page status changes in same text", () => {
			const before: TreeSnapshot = {
				sectionPaths: [],
				texts: [
					{
						pageStatuses: {
							"000": TextStatus.NotStarted,
							"001": TextStatus.NotStarted,
						},
						path: ["Section", "Book"] as TreePath,
					},
				],
			};

			const after: TreeSnapshot = {
				sectionPaths: [],
				texts: [
					{
						pageStatuses: {
							"000": TextStatus.Done,
							"001": TextStatus.Done,
						},
						path: ["Section", "Book"] as TreePath,
					},
				],
			};

			const diff = differ.diff(before, after);

			expect(diff.statusChanges.length).toBe(2);
		});

		it("should not report status change if status unchanged", () => {
			const before: TreeSnapshot = {
				sectionPaths: [],
				texts: [
					{
						pageStatuses: { "000": TextStatus.Done },
						path: ["Section", "Text"] as TreePath,
					},
				],
			};

			const after: TreeSnapshot = {
				sectionPaths: [],
				texts: [
					{
						pageStatuses: { "000": TextStatus.Done },
						path: ["Section", "Text"] as TreePath,
					},
				],
			};

			const diff = differ.diff(before, after);

			expect(diff.statusChanges.length).toBe(0);
		});
	});

	describe("diff - empty cases", () => {
		it("should return empty diff for identical snapshots", () => {
			const snapshot: TreeSnapshot = {
				sectionPaths: [["A"] as TreePath],
				texts: [
					{
						pageStatuses: { "000": TextStatus.Done },
						path: ["A", "Text"] as TreePath,
					},
				],
			};

			const diff = differ.diff(snapshot, snapshot);

			expect(diff.addedTexts.length).toBe(0);
			expect(diff.removedTexts.length).toBe(0);
			expect(diff.addedSections.length).toBe(0);
			expect(diff.removedSections.length).toBe(0);
			expect(diff.statusChanges.length).toBe(0);
		});

		it("should return empty diff for two empty snapshots", () => {
			const empty: TreeSnapshot = { sectionPaths: [], texts: [] };

			const diff = differ.diff(empty, empty);

			expect(diff.addedTexts.length).toBe(0);
			expect(diff.removedTexts.length).toBe(0);
			expect(diff.addedSections.length).toBe(0);
			expect(diff.removedSections.length).toBe(0);
			expect(diff.statusChanges.length).toBe(0);
		});
	});
});

