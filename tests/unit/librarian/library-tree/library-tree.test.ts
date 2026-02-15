import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { makeCodecRulesFromSettings, makeCodecs } from "../../../../src/commanders/librarian/codecs";
import { Healer } from "../../../../src/commanders/librarian/healer/healer";
import { codexImpactToIncrementalRecreations } from "../../../../src/commanders/librarian/healer/library-tree/codex/codex-impact-to-actions";
import { generateChildrenList } from "../../../../src/commanders/librarian/healer/library-tree/codex/generate-codex-content";
import { mergeCodexImpacts } from "../../../../src/commanders/librarian/healer/library-tree/codex/merge-codex-impacts";
import { TreeActionType } from "../../../../src/commanders/librarian/healer/library-tree/tree-action/types/tree-action";
import { TreeNodeStatus } from "../../../../src/commanders/librarian/healer/library-tree/tree-node/types/atoms";
import type { NodeName } from "../../../../src/commanders/librarian/types/schemas/node-name";
import { MD } from "../../../../src/managers/obsidian/vault-action-manager/types/literals";
import { SplitPathKind } from "../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { defaultSettingsForUnitTests } from "../../common-utils/consts";
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
									Note: { kind: "Scroll" as const, status: TreeNodeStatus.NotStarted },
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
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipe", "pie"],
				},
				targetLocator: locator,
			});

			const shape = toShape(healer);
			expect(shape.children?.recipe).toBeDefined();
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.recipe?.children?.pie?.children?.Note).toEqual({
				kind: "Scroll",
				status: TreeNodeStatus.NotStarted,
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
									Note: { kind: "Scroll" as const },
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
									Note1: { kind: "Scroll" as const },
									Note2: { kind: "Scroll" as const },
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
							Note: { kind: "Scroll" as const },
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

		it("renames scroll leaf", () => {
			const healer = makeTree({
				children: {
					recipe: {
						children: {
							Untitled: { kind: "Scroll" as const, status: TreeNodeStatus.NotStarted },
						},
					},
				},
				libraryRoot: "Library" as NodeName,
			});

			// Rename Untitled -> Note
			const locator = makeScrollLocator(
				["Library" as NodeName, "recipe" as NodeName],
				"Untitled" as NodeName,
			);

			healer.getHealingActionsFor({
				actionType: TreeActionType.Rename,
				newNodeName: "Note" as NodeName,
				targetLocator: locator,
			});

			const shape = toShape(healer);
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.recipe?.children?.Untitled).toBeUndefined();
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.recipe?.children?.Note).toEqual({
				kind: "Scroll",
				status: TreeNodeStatus.NotStarted,
			});
		});

		it("BUG: Create then Rename scroll - simulates file created, healed, user renamed", () => {
			// Step 1: Start with empty tree
			const healer = makeTree({
				children: {
					Recipe: {
						children: {
							Soup: {
								children: {
									Ramen: {},
								},
							},
						},
					},
				},
				libraryRoot: "Library" as NodeName,
			});

			// Step 2: Create a scroll (simulates user creating Untitled.md)
			const createLocator = makeScrollLocator(
				["Library" as NodeName, "Recipe" as NodeName, "Soup" as NodeName, "Ramen" as NodeName],
				"Untitled" as NodeName,
			);

			healer.getHealingActionsFor({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Untitled",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "Recipe", "Soup", "Ramen"],
				},
				targetLocator: createLocator,
			});

			// Verify scroll was created
			let shape = toShape(healer);
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.Recipe?.children?.Soup?.children?.Ramen?.children?.Untitled).toEqual({
				kind: "Scroll",
				status: TreeNodeStatus.NotStarted,
			});

			// Step 3: Rename the scroll (simulates user renaming to Draft after healing)
			// The key question: does the rename locator match the created node?
			const renameLocator = makeScrollLocator(
				["Library" as NodeName, "Recipe" as NodeName, "Soup" as NodeName, "Ramen" as NodeName],
				"Untitled" as NodeName,
			);

			healer.getHealingActionsFor({
				actionType: TreeActionType.Rename,
				newNodeName: "Draft" as NodeName,
				targetLocator: renameLocator,
			});

			// Verify scroll was renamed
			shape = toShape(healer);
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.Recipe?.children?.Soup?.children?.Ramen?.children?.Untitled).toBeUndefined();
			// @ts-expect-error - accessing nested structure
			expect(shape.children?.Recipe?.children?.Soup?.children?.Ramen?.children?.Draft).toEqual({
				kind: "Scroll",
				status: TreeNodeStatus.NotStarted,
			});
		});

		it("COMPREHENSIVE: Create then Rename - verify codex content generation", () => {
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			// Step 1: Start with empty tree
			const healer = makeTree({
				children: {
					Recipe: {
						children: {
							Soup: {
								children: {
									Ramen: {},
								},
							},
						},
					},
				},
				libraryRoot: "Library" as NodeName,
			});

			// Step 2: Create a scroll (simulates user creating Untitled.md)
			const createLocator = makeScrollLocator(
				["Library" as NodeName, "Recipe" as NodeName, "Soup" as NodeName, "Ramen" as NodeName],
				"Untitled" as NodeName,
			);

			const createResult = healer.getHealingActionsFor({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Untitled",
					extension: MD,
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "Recipe", "Soup", "Ramen"],
				},
				targetLocator: createLocator,
			});

			// Process codex impacts AFTER create - this captures section reference
			const createCodexActions = codexImpactToIncrementalRecreations(
				createResult.codexImpact,
				healer,
				codecs,
			);

			// Find the ProcessCodexAction for Ramen section
			const ramenCreateAction = createCodexActions.find(
				(a) => a.kind === "ProcessCodex" && a.payload.section.nodeName === "Ramen",
			);
			expect(ramenCreateAction).toBeDefined();

			// At this point, section.children should have "Untitled"
			if (ramenCreateAction && ramenCreateAction.kind === "ProcessCodex") {
				const childNames = Object.values(ramenCreateAction.payload.section.children).map(c => c.nodeName);
				console.log("[AFTER CREATE] Ramen section children:", childNames);
				expect(childNames).toContain("Untitled");
			}

			// Step 3: Rename the scroll to Draft
			const renameLocator = makeScrollLocator(
				["Library" as NodeName, "Recipe" as NodeName, "Soup" as NodeName, "Ramen" as NodeName],
				"Untitled" as NodeName,
			);

			const renameResult = healer.getHealingActionsFor({
				actionType: TreeActionType.Rename,
				newNodeName: "Draft" as NodeName,
				targetLocator: renameLocator,
			});

			// Process codex impacts AFTER rename - this should capture updated section reference
			const renameCodexActions = codexImpactToIncrementalRecreations(
				renameResult.codexImpact,
				healer,
				codecs,
			);

			// Find the ProcessCodexAction for Ramen section
			const ramenRenameAction = renameCodexActions.find(
				(a) => a.kind === "ProcessCodex" && a.payload.section.nodeName === "Ramen",
			);
			expect(ramenRenameAction).toBeDefined();

			// At this point, section.children should have "Draft" (after rename)
			if (ramenRenameAction && ramenRenameAction.kind === "ProcessCodex") {
				const childNames = Object.values(ramenRenameAction.payload.section.children).map(c => c.nodeName);
				console.log("[AFTER RENAME] Ramen section children:", childNames);
				expect(childNames).toContain("Draft");
				expect(childNames).not.toContain("Untitled");
			}

			// IMPORTANT: Also check if the original createCodexAction's section was updated
			// Since section is passed by reference, it should have the updated nodeName
			if (ramenCreateAction && ramenCreateAction.kind === "ProcessCodex") {
				const childNamesAfterRename = Object.values(ramenCreateAction.payload.section.children).map(c => c.nodeName);
				console.log("[CREATE ACTION AFTER RENAME] Ramen section children:", childNamesAfterRename);
				// This should ALSO show "Draft" because it's the same reference!
				expect(childNamesAfterRename).toContain("Draft");
			}
		});
	});

	describe("apply ChangeStatus", () => {
		it("updates leaf status", () => {
			const healer = makeTree({
				children: {
					Note: { kind: "Scroll" as const, status: TreeNodeStatus.NotStarted },
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
				kind: "Scroll",
				status: TreeNodeStatus.Done,
			});
		});

		it("propagates status to descendants", () => {
			const healer = makeTree({
				children: {
					recipe: {
						children: {
							Note1: { kind: "Scroll" as const, status: TreeNodeStatus.NotStarted },
							Note2: { kind: "Scroll" as const, status: TreeNodeStatus.NotStarted },
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
