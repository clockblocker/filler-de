import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { Healer } from "../../../../src/commanders/librarian-new/healer/healer";
import { TreeActionType } from "../../../../src/commanders/librarian-new/healer/library-tree/tree-action/types/tree-action";
import { TreeNodeStatus } from "../../../../src/commanders/librarian-new/healer/library-tree/tree-node/types/atoms";
import type { NodeName } from "../../../../src/commanders/librarian-new/types/schemas/node-name";
import { SplitPathType } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { setupGetParsedUserSettingsSpy } from "../../common-utils/setup-spy";
import {
	makeScrollLocator,
	makeSectionLocator,
	makeTree,
	toShape,
} from "./tree-test-helpers";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("Healer", () => {
	describe("makeTree / toShape roundtrip", () => {
		it("empty tree", () => {
			const tree = makeTree({ libraryRoot: "Library" as NodeName });
			expect(toShape(tree)).toEqual({
				children: undefined,
				libraryRoot: "Library",
			});
		});

		it("tree with sections and leaves", () => {
			const shape = {
				children: {
					recipe: {
						children: {
							pie: {
								children: {
									Note: { status: TreeNodeStatus.NotStarted, type: "Scroll" as const },
								},
							},
						},
					},
				},
				libraryRoot: "Library" as NodeName,
			};
			const tree = makeTree(shape);
			expect(toShape(tree)).toEqual(shape);
		});
	});

	describe("apply Create", () => {
		it("creates leaf with implicit sections", () => {
			const healer = makeTree({ libraryRoot: "Library" as NodeName });

			// Chain INCLUDES Library root
			const locator = makeScrollLocator(
				["Library" as NodeName, "recipe" as NodeName, "pie" as NodeName],
				"Note" as NodeName,
			);

			healer.getHealingActionsFor({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note",
					extension: "md",
					pathParts: ["Library", "recipe", "pie"],
					type: SplitPathType.MdFile,
				},
				targetLocator: locator,
			});

			const shape = toShape(healer);
			expect(shape.children?.recipe).toBeDefined();
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.recipe?.children?.pie?.children?.Note).toEqual({
				status: TreeNodeStatus.NotStarted,
				type: "Scroll",
			});
		});
	});

	describe("apply Delete", () => {
		it("deletes leaf and prunes empty ancestors", () => {
			const healer = makeTree({
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
				libraryRoot: "Library" as NodeName,
			});

			// Chain INCLUDES Library root
			const locator = makeScrollLocator(
				["Library" as NodeName, "recipe" as NodeName, "pie" as NodeName],
				"Note" as NodeName,
			);

			healer.getHealingActionsFor({
				actionType: TreeActionType.Delete,
				targetLocator: locator,
			});

			const shape = toShape(healer);
			// All empty ancestors should be pruned
			expect(shape.children).toBeUndefined();
		});

		it("preserves non-empty siblings", () => {
			const healer = makeTree({
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
				libraryRoot: "Library" as NodeName,
			});

			// Chain INCLUDES Library root
			const locator = makeScrollLocator(
				["Library" as NodeName, "recipe" as NodeName, "pie" as NodeName],
				"Note1" as NodeName,
			);

			healer.getHealingActionsFor({
				actionType: TreeActionType.Delete,
				targetLocator: locator,
			});

			const shape = toShape(healer);
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.recipe?.children?.pie?.children?.Note2).toBeDefined();
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.recipe?.children?.pie?.children?.Note1).toBeUndefined();
		});
	});

	describe("apply Rename", () => {
		it("renames section", () => {
			const healer = makeTree({
				children: {
					pie: {
						children: {
							Note: { type: "Scroll" as const },
						},
					},
				},
				libraryRoot: "Library" as NodeName,
			});

			// Chain INCLUDES Library root
			const locator = makeSectionLocator(["Library" as NodeName], "pie" as NodeName);

			healer.getHealingActionsFor({
				actionType: TreeActionType.Rename,
				newNodeName: "pies" as NodeName,
				targetLocator: locator,
			});

			const shape = toShape(healer);
			expect(shape.children?.pie).toBeUndefined();
			expect(shape.children?.pies).toBeDefined();
		});
	});

	describe("apply ChangeStatus", () => {
		it("updates leaf status", () => {
			const healer = makeTree({
				children: {
					Note: { status: TreeNodeStatus.NotStarted, type: "Scroll" as const },
				},
				libraryRoot: "Library" as NodeName,
			});

			// Chain INCLUDES Library root
			const locator = makeScrollLocator(["Library" as NodeName], "Note" as NodeName);

			healer.getHealingActionsFor({
				actionType: TreeActionType.ChangeStatus,
				newStatus: TreeNodeStatus.Done,
				targetLocator: locator,
			});

			const shape = toShape(healer);
			expect(shape.children?.Note).toEqual({
				status: TreeNodeStatus.Done,
				type: "Scroll",
			});
		});

		it("propagates status to descendants", () => {
			const healer = makeTree({
				children: {
					recipe: {
						children: {
							Note1: { status: TreeNodeStatus.NotStarted, type: "Scroll" as const },
							Note2: { status: TreeNodeStatus.NotStarted, type: "Scroll" as const },
						},
					},
				},
				libraryRoot: "Library" as NodeName,
			});

			// Chain INCLUDES Library root
			const locator = makeSectionLocator(["Library" as NodeName], "recipe" as NodeName);

			healer.getHealingActionsFor({
				actionType: TreeActionType.ChangeStatus,
				newStatus: TreeNodeStatus.Done,
				targetLocator: locator,
			});

			const shape = toShape(healer);
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.recipe?.children?.Note1?.status).toBe(TreeNodeStatus.Done);
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.recipe?.children?.Note2?.status).toBe(TreeNodeStatus.Done);
		});
	});
});
