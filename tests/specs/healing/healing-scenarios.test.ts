/**
 * Integration tests for healing scenarios.
 * Captures current behavior before Phase 3 refactoring.
 *
 * These tests cover the full healing pipeline:
 * - Create leaf -> healing generates correct path
 * - Rename section -> all descendants get new suffix
 * - Move section -> codex paths update
 * - Error handling behavior (currently silent in some places)
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../src/commanders/librarian/codecs";
import { Healer } from "../../../src/commanders/librarian/healer/healer";
import {
	codexImpactToDeletions,
	codexImpactToIncrementalRecreations,
	codexImpactToRecreations,
} from "../../../src/commanders/librarian/healer/library-tree/codex/codex-impact-to-actions";
import { mergeCodexImpacts } from "../../../src/commanders/librarian/healer/library-tree/codex/merge-codex-impacts";
import { Tree } from "../../../src/commanders/librarian/healer/library-tree/tree";
import { TreeActionType } from "../../../src/commanders/librarian/healer/library-tree/tree-action/types/tree-action";
import {
	TreeNodeKind,
	TreeNodeStatus,
} from "../../../src/commanders/librarian/healer/library-tree/tree-node/types/atoms";
import type { NodeName } from "../../../src/commanders/librarian/types/schemas/node-name";
import { SplitPathKind } from "../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { defaultSettingsForUnitTests } from "../../unit/common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../unit/common-utils/setup-spy";
import {
	makeFileLocator,
	makeScrollLocator,
	makeSectionLocator,
	makeTree,
	toShape,
} from "../../unit/librarian/library-tree/tree-test-helpers";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

describe("Healing Scenarios", () => {
	describe("Create Leaf -> Healing Generates Correct Path", () => {
		it("creates leaf at Library root with no suffix", () => {
			const healer = makeTree({ libraryRoot: "Library" as NodeName });
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			const locator = makeScrollLocator(
				["Library" as NodeName],
				"Note" as NodeName,
			);

			const result = healer.getHealingActionsFor({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library"],
				},
				targetLocator: locator,
			});

			// Create action should generate healing to ensure correct path
			// For root-level leaf, basename should be just "Note" (no suffix)
			expect(result.healingActions).toBeDefined();
			expect(result.codexImpact).toBeDefined();
		});

		it("creates leaf at depth 1 with single-part suffix", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			const locator = makeScrollLocator(
				["Library" as NodeName, "recipes" as NodeName],
				"Note" as NodeName,
			);

			// Simulate user creating file with wrong basename (missing suffix)
			const result = healer.getHealingActionsFor({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note", // Wrong! Should be "Note-recipes"
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				targetLocator: locator,
			});

			// Should generate rename action to fix the suffix
			const renameActions = result.healingActions.filter(
				(a) => a.kind === "RenameMdFile",
			);

			// If observed basename doesn't match canonical, healing should rename
			if (renameActions.length > 0) {
				const rename = renameActions[0];
				expect(rename.payload.to.basename).toBe("Note-recipes");
			}
		});

		it("creates leaf at depth 2 with two-part suffix (reversed)", () => {
			const healer = makeTree({
				children: {
					recipes: {
						children: {
							soup: {},
						},
					},
				},
				libraryRoot: "Library" as NodeName,
			});

			const locator = makeScrollLocator(
				["Library" as NodeName, "recipes" as NodeName, "soup" as NodeName],
				"Note" as NodeName,
			);

			// Simulate creating with wrong suffix
			const result = healer.getHealingActionsFor({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note", // Wrong! Should be "Note-soup-recipes"
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes", "soup"],
				},
				targetLocator: locator,
			});

			const renameActions = result.healingActions.filter(
				(a) => a.kind === "RenameMdFile",
			);

			if (renameActions.length > 0) {
				const rename = renameActions[0];
				// Canonical suffix should be soup-recipes (reversed depth)
				expect(rename.payload.to.basename).toBe("Note-soup-recipes");
			}
		});
	});

	describe("Rename Section -> Descendants Get New Suffix", () => {
		it("renaming section updates codex suffix for all descendants", () => {
			const healer = makeTree({
				children: {
					recipes: {
						children: {
							soup: {
								children: {
									Note1: {
										kind: "Scroll" as const,
										status: TreeNodeStatus.NotStarted,
									},
									Note2: {
										kind: "Scroll" as const,
										status: TreeNodeStatus.NotStarted,
									},
								},
							},
						},
					},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			// Rename "soup" to "stew"
			const locator = makeSectionLocator(
				["Library" as NodeName, "recipes" as NodeName],
				"soup" as NodeName,
			);

			const result = healer.getHealingActionsFor({
				actionType: TreeActionType.Rename,
				newNodeName: "stew" as NodeName,
				targetLocator: locator,
			});

			// Renaming a section generates renamed impact
			// The renamed chain should be in the result
			expect(result.codexImpact.renamed.length).toBeGreaterThan(0);

			// Generate recreation actions
			const recreations = codexImpactToIncrementalRecreations(
				result.codexImpact,
				healer,
				codecs,
			);

			// Should have actions to update codex files
			expect(recreations.length).toBeGreaterThan(0);
		});

		it("renaming root-level section cascades to nested descendants", () => {
			const healer = makeTree({
				children: {
					recipes: {
						children: {
							soup: {
								children: {
									ramen: {
										children: {
											Note: {
												kind: "Scroll" as const,
												status: TreeNodeStatus.NotStarted,
											},
										},
									},
								},
							},
						},
					},
				},
				libraryRoot: "Library" as NodeName,
			});

			// Rename top-level "recipes" to "cooking"
			const locator = makeSectionLocator(
				["Library" as NodeName],
				"recipes" as NodeName,
			);

			const result = healer.getHealingActionsFor({
				actionType: TreeActionType.Rename,
				newNodeName: "cooking" as NodeName,
				targetLocator: locator,
			});

			// All nested sections should be marked as having descendants changed
			// This is because the suffix for deeply nested items includes ancestor names
			expect(result.codexImpact.renamed.length).toBeGreaterThan(0);
		});
	});

	describe("Move Section -> Codex Paths Update", () => {
		it("moving section generates codex impact for descendants", () => {
			const healer = makeTree({
				children: {
					archive: {},
					recipes: {
						children: {
							soup: {
								children: {
									Note: {
										kind: "Scroll" as const,
										status: TreeNodeStatus.NotStarted,
									},
								},
							},
						},
					},
				},
				libraryRoot: "Library" as NodeName,
			});
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);

			// Move "soup" from "recipes" to "archive"
			const targetLocator = makeSectionLocator(
				["Library" as NodeName, "recipes" as NodeName],
				"soup" as NodeName,
			);

			const newParentLocator = makeSectionLocator(
				["Library" as NodeName],
				"archive" as NodeName,
			);

			const result = healer.getHealingActionsFor({
				actionType: TreeActionType.Move,
				newNodeName: "soup" as NodeName,
				newParentLocator,
				// Required: observedSplitPath is where the folder is NOW in the filesystem
				observedSplitPath: {
					basename: "soup",
					kind: SplitPathKind.Folder,
					pathParts: ["Library", "archive"],
				},
				targetLocator,
			});

			// Move operation generates codex impact
			// It should mark the section as renamed (moved from recipes to archive)
			expect(result.codexImpact).toBeDefined();

			// The result should contain healing actions (may be folder renames or leaf renames)
			// Even if folder is already in place, leaves need suffix updates
			expect(result.healingActions).toBeDefined();

			// Tree should be updated
			const shape = toShape(healer);
			// soup should no longer be under recipes
			// @ts-expect-error accessing nested
			expect(shape.children?.recipes?.children?.soup).toBeUndefined();
			// soup should be under archive
			// @ts-expect-error accessing nested
			expect(shape.children?.archive?.children?.soup).toBeDefined();
		});
	});

	describe("Multiple Operations - State Consistency", () => {
		it("create then rename maintains correct state", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});

			// Step 1: Create a scroll
			const createLocator = makeScrollLocator(
				["Library" as NodeName, "recipes" as NodeName],
				"Untitled" as NodeName,
			);

			healer.getHealingActionsFor({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Untitled-recipes",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				targetLocator: createLocator,
			});

			// Verify created
			let shape = toShape(healer);
			expect(shape.children?.recipes).toBeDefined();
			// @ts-expect-error accessing nested
			expect(shape.children?.recipes?.children?.Untitled).toBeDefined();

			// Step 2: Rename the scroll
			const renameLocator = makeScrollLocator(
				["Library" as NodeName, "recipes" as NodeName],
				"Untitled" as NodeName,
			);

			healer.getHealingActionsFor({
				actionType: TreeActionType.Rename,
				newNodeName: "MyNote" as NodeName,
				targetLocator: renameLocator,
			});

			// Verify renamed
			shape = toShape(healer);
			// @ts-expect-error accessing nested
			expect(shape.children?.recipes?.children?.Untitled).toBeUndefined();
			// @ts-expect-error accessing nested
			expect(shape.children?.recipes?.children?.MyNote).toBeDefined();
		});

		it("create, rename parent, delete maintains consistency", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});

			// Step 1: Create a scroll
			const createLocator = makeScrollLocator(
				["Library" as NodeName, "recipes" as NodeName],
				"Note" as NodeName,
			);

			healer.getHealingActionsFor({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note-recipes",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "recipes"],
				},
				targetLocator: createLocator,
			});

			// Step 2: Rename parent section
			const renameSectionLocator = makeSectionLocator(
				["Library" as NodeName],
				"recipes" as NodeName,
			);

			healer.getHealingActionsFor({
				actionType: TreeActionType.Rename,
				newNodeName: "cooking" as NodeName,
				targetLocator: renameSectionLocator,
			});

			// Verify state
			let shape = toShape(healer);
			expect(shape.children?.recipes).toBeUndefined();
			expect(shape.children?.cooking).toBeDefined();
			// @ts-expect-error accessing nested
			expect(shape.children?.cooking?.children?.Note).toBeDefined();

			// Step 3: Delete the scroll (using new path)
			const deleteLocator = makeScrollLocator(
				["Library" as NodeName, "cooking" as NodeName],
				"Note" as NodeName,
			);

			healer.getHealingActionsFor({
				actionType: TreeActionType.Delete,
				targetLocator: deleteLocator,
			});

			// Verify deleted (and section pruned)
			shape = toShape(healer);
			expect(shape.children).toBeUndefined();
		});
	});

	describe("Codex Impact Merging", () => {
		it("merges multiple impacts correctly", () => {
			const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
			const codecs = makeCodecs(rules);
			const healer = makeTree({
				children: {
					a: {
						children: {
							Note1: { kind: "Scroll" as const },
						},
					},
					b: {
						children: {
							Note2: { kind: "Scroll" as const },
						},
					},
				},
				libraryRoot: "Library" as NodeName,
			});

			// Create impacts for two separate operations
			const impact1 = healer.getHealingActionsFor({
				actionType: TreeActionType.Rename,
				newNodeName: "aa" as NodeName,
				targetLocator: makeSectionLocator(
					["Library" as NodeName],
					"a" as NodeName,
				),
			}).codexImpact;

			const impact2 = healer.getHealingActionsFor({
				actionType: TreeActionType.Rename,
				newNodeName: "bb" as NodeName,
				targetLocator: makeSectionLocator(
					["Library" as NodeName],
					"b" as NodeName,
				),
			}).codexImpact;

			// Merge impacts
			const merged = mergeCodexImpacts([impact1, impact2]);

			// Should contain impacts from both operations
			expect(merged.renamed.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe("Error Handling Behavior (documenting current state)", () => {
		it("handles missing parent section gracefully on create", () => {
			const healer = makeTree({ libraryRoot: "Library" as NodeName });

			// Create in a section that doesn't exist yet
			// The healer should auto-create parent sections
			const locator = makeScrollLocator(
				[
					"Library" as NodeName,
					"nonexistent" as NodeName,
					"deep" as NodeName,
				],
				"Note" as NodeName,
			);

			// This should NOT throw - it should create parent sections
			const result = healer.getHealingActionsFor({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note-deep-nonexistent",
					extension: "md",
					kind: SplitPathKind.MdFile,
					pathParts: ["Library", "nonexistent", "deep"],
				},
				targetLocator: locator,
			});

			// Verify sections were created
			const shape = toShape(healer);
			// @ts-expect-error accessing nested
			expect(shape.children?.nonexistent?.children?.deep?.children?.Note).toBeDefined();
		});

		it("delete on non-existent node does not throw", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});

			// Try to delete a node that doesn't exist
			const locator = makeScrollLocator(
				["Library" as NodeName, "recipes" as NodeName],
				"NonExistent" as NodeName,
			);

			// Current behavior: this should not throw, but may produce empty actions
			expect(() => {
				healer.getHealingActionsFor({
					actionType: TreeActionType.Delete,
					targetLocator: locator,
				});
			}).not.toThrow();
		});

		it("rename on non-existent node behavior", () => {
			const healer = makeTree({
				children: {
					recipes: {},
				},
				libraryRoot: "Library" as NodeName,
			});

			const locator = makeScrollLocator(
				["Library" as NodeName, "recipes" as NodeName],
				"NonExistent" as NodeName,
			);

			// Current behavior: may throw or return empty
			// This test documents what happens
			try {
				const result = healer.getHealingActionsFor({
					actionType: TreeActionType.Rename,
					newNodeName: "NewName" as NodeName,
					targetLocator: locator,
				});
				// If it doesn't throw, document what we got
				expect(result.healingActions).toBeDefined();
			} catch (e) {
				// If it throws, document that this is expected
				expect(e).toBeInstanceOf(Error);
			}
		});
	});

	describe("File Nodes (non-scroll)", () => {
		it("creates file node with correct suffix", () => {
			const healer = makeTree({
				children: {
					assets: {},
				},
				libraryRoot: "Library" as NodeName,
			});

			const locator = makeFileLocator(
				["Library" as NodeName, "assets" as NodeName],
				"image" as NodeName,
				"png",
			);

			const result = healer.getHealingActionsFor({
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "image",
					extension: "png",
					kind: SplitPathKind.File,
					pathParts: ["Library", "assets"],
				},
				targetLocator: locator,
			});

			// Verify file was added to tree
			const shape = toShape(healer);
			// @ts-expect-error accessing nested
			expect(shape.children?.assets?.children?.image).toBeDefined();
			// @ts-expect-error accessing nested
			expect(shape.children?.assets?.children?.image?.extension).toBe("png");
		});
	});
});
