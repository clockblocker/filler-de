import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import {
	LibraryTree,
} from "../../../../src/commanders/librarian-new/library-tree/library-tree";
import {
	makeTree,
	toShape,
	makeScrollLocator,
	makeSectionLocator,
} from "../../../../src/commanders/librarian-new/library-tree/test-helpers";
import { TreeActionType } from "../../../../src/commanders/librarian-new/library-tree/tree-action/types/tree-action";
import { TreeNodeStatus } from "../../../../src/commanders/librarian-new/library-tree/tree-node/types/atoms";
import { SplitPathType } from "../../../../src/obsidian-vault-action-manager/types/split-path";
import type { NodeName } from "../../../../src/commanders/librarian-new/types/schemas/node-name";
import * as globalState from "../../../../src/global-state/global-state";
import type { ParsedUserSettings } from "../../../../src/global-state/parsed-settings";

const defaultSettings: ParsedUserSettings = {
	apiProvider: "google",
	googleApiKey: "",
	maxSectionDepth: 6,
	showScrollsInCodexesForDepth: 0,
	splitPathToLibraryRoot: {
		basename: "Library",
		pathParts: [],
		type: SplitPathType.Folder,
	},
	suffixDelimiter: "-",
};

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = spyOn(
		globalState,
		"getParsedUserSettings",
	).mockReturnValue({ ...defaultSettings });
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("LibraryTree", () => {
	describe("makeTree / toShape roundtrip", () => {
		it("empty tree", () => {
			const tree = makeTree({ libraryRoot: "Library" as NodeName });
			expect(toShape(tree)).toEqual({
				libraryRoot: "Library",
				children: undefined,
			});
		});

		it("tree with sections and leaves", () => {
			const shape = {
				libraryRoot: "Library" as NodeName,
				children: {
					recipe: {
						children: {
							pie: {
								children: {
									Note: { type: "Scroll" as const, status: TreeNodeStatus.NotStarted },
								},
							},
						},
					},
				},
			};
			const tree = makeTree(shape);
			expect(toShape(tree)).toEqual(shape);
		});
	});

	describe("apply Create", () => {
		it("creates leaf with implicit sections", () => {
			const tree = makeTree({ libraryRoot: "Library" as NodeName });

			const locator = makeScrollLocator(
				["recipe" as NodeName, "pie" as NodeName],
				"Note" as NodeName,
			);

			tree.apply({
				actionType: TreeActionType.Create,
				targetLocator: locator,
				observedSplitPath: {
					type: SplitPathType.MdFile,
					pathParts: ["Library", "recipe", "pie"],
					basename: "Note",
					extension: "md",
				},
			});

			const shape = toShape(tree);
			expect(shape.children?.recipe).toBeDefined();
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.recipe?.children?.pie?.children?.Note).toEqual({
				type: "Scroll",
				status: TreeNodeStatus.NotStarted,
			});
		});
	});

	describe("apply Delete", () => {
		it("deletes leaf and prunes empty ancestors", () => {
			const tree = makeTree({
				libraryRoot: "Library" as NodeName,
				children: {
					recipe: {
						children: {
							pie: {
								children: {
									Note: { type: "Scroll" as const },
								},
							},
						},
					},
				},
			});

			const locator = makeScrollLocator(
				["recipe" as NodeName, "pie" as NodeName],
				"Note" as NodeName,
			);

			tree.apply({
				actionType: TreeActionType.Delete,
				targetLocator: locator,
			});

			const shape = toShape(tree);
			// All empty ancestors should be pruned
			expect(shape.children).toBeUndefined();
		});

		it("preserves non-empty siblings", () => {
			const tree = makeTree({
				libraryRoot: "Library" as NodeName,
				children: {
					recipe: {
						children: {
							pie: {
								children: {
									Note1: { type: "Scroll" as const },
									Note2: { type: "Scroll" as const },
								},
							},
						},
					},
				},
			});

			const locator = makeScrollLocator(
				["recipe" as NodeName, "pie" as NodeName],
				"Note1" as NodeName,
			);

			tree.apply({
				actionType: TreeActionType.Delete,
				targetLocator: locator,
			});

			const shape = toShape(tree);
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.recipe?.children?.pie?.children?.Note2).toBeDefined();
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.recipe?.children?.pie?.children?.Note1).toBeUndefined();
		});
	});

	describe("apply Rename", () => {
		it("renames section", () => {
			const tree = makeTree({
				libraryRoot: "Library" as NodeName,
				children: {
					pie: {
						children: {
							Note: { type: "Scroll" as const },
						},
					},
				},
			});

			const locator = makeSectionLocator([], "pie" as NodeName);

			tree.apply({
				actionType: TreeActionType.Rename,
				targetLocator: locator,
				newNodeName: "pies" as NodeName,
			});

			const shape = toShape(tree);
			expect(shape.children?.pie).toBeUndefined();
			expect(shape.children?.pies).toBeDefined();
		});
	});

	describe("apply ChangeStatus", () => {
		it("updates leaf status", () => {
			const tree = makeTree({
				libraryRoot: "Library" as NodeName,
				children: {
					Note: { type: "Scroll" as const, status: TreeNodeStatus.NotStarted },
				},
			});

			const locator = makeScrollLocator([], "Note" as NodeName);

			tree.apply({
				actionType: TreeActionType.ChangeStatus,
				targetLocator: locator,
				newStatus: TreeNodeStatus.Done,
			});

			const shape = toShape(tree);
			expect(shape.children?.Note).toEqual({
				type: "Scroll",
				status: TreeNodeStatus.Done,
			});
		});

		it("propagates status to descendants", () => {
			const tree = makeTree({
				libraryRoot: "Library" as NodeName,
				children: {
					recipe: {
						children: {
							Note1: { type: "Scroll" as const, status: TreeNodeStatus.NotStarted },
							Note2: { type: "Scroll" as const, status: TreeNodeStatus.NotStarted },
						},
					},
				},
			});

			const locator = makeSectionLocator([], "recipe" as NodeName);

			tree.apply({
				actionType: TreeActionType.ChangeStatus,
				targetLocator: locator,
				newStatus: TreeNodeStatus.Done,
			});

			const shape = toShape(tree);
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.recipe?.children?.Note1?.status).toBe(TreeNodeStatus.Done);
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.recipe?.children?.Note2?.status).toBe(TreeNodeStatus.Done);
		});
	});
});

