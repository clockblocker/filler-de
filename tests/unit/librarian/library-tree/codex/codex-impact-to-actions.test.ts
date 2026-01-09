import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	codexImpactToActions,
	type TreeAccessor,
} from "../../../../../src/commanders/librarian-new/library-tree/codex/codex-impact-to-actions";
import type { CodexImpact } from "../../../../../src/commanders/librarian-new/library-tree/codex/compute-codex-impact";
import {
	TreeNodeStatus,
	TreeNodeType,
} from "../../../../../src/commanders/librarian-new/library-tree/tree-node/types/atoms";
import type {
	SectionNodeSegmentId,
} from "../../../../../src/commanders/librarian-new/library-tree/tree-node/types/node-segment-id";
import type {
	ScrollNode,
	SectionNode,
} from "../../../../../src/commanders/librarian-new/library-tree/tree-node/types/tree-node";
import type { NodeName } from "../../../../../src/commanders/librarian-new/types/schemas/node-name";
import * as globalState from "../../../../../src/global-state/global-state";
import { SplitPathType } from "../../../../../src/managers/obsidian/vault-action-manager/types/split-path";
import { defaultSettingsForUnitTests } from "../../../common-utils/consts";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	getParsedUserSettingsSpy = spyOn(
		globalState,
		"getParsedUserSettings",
	).mockReturnValue({ ...defaultSettingsForUnitTests });
});

afterEach(() => {
	getParsedUserSettingsSpy.mockRestore();
});

// ─── Helpers ───

const sec = (name: string): SectionNodeSegmentId =>
	`${name}﹘Section﹘` as SectionNodeSegmentId;

const scroll = (
	name: string,
	status: TreeNodeStatus = TreeNodeStatus.NotStarted,
): ScrollNode => ({
	extension: "md",
	nodeName: name as NodeName,
	status,
	type: TreeNodeType.Scroll,
});

const section = (
	name: string,
	children: Record<string, SectionNode | ScrollNode> = {},
): SectionNode => ({
	children: children as SectionNode["children"],
	nodeName: name as NodeName,
	type: TreeNodeType.Section,
});

function makeTreeAccessor(root: SectionNode): TreeAccessor {
	return {
		findSection(chain: SectionNodeSegmentId[]): SectionNode | undefined {
			if (chain.length === 0) return undefined;
			if (chain.length === 1) return root;

			let current: SectionNode = root;
			for (let i = 1; i < chain.length; i++) {
				const segId = chain[i];
				if (!segId) return undefined;
				const child = current.children[segId];
				if (!child || child.type !== TreeNodeType.Section) return undefined;
				current = child;
			}
			return current;
		},
		getRoot() {
			return root;
		},
	};
}

describe("codexImpactToActions", () => {
	describe("contentChanged", () => {
		it("generates UpsertCodex for each changed section", () => {
			const root = section("Library", {
				"A﹘Section﹘": section("A", {
					"Note﹘Scroll﹘md": scroll("Note"),
				}),
			});
			const tree = makeTreeAccessor(root);

			const impact: CodexImpact = {
				contentChanged: [[sec("Library")], [sec("Library"), sec("A")]],
				deleted: [],
				descendantsChanged: [],
				renamed: [],
			};

			const actions = codexImpactToActions(impact, tree);

			expect(actions.length).toBe(2);
			expect(actions[0]?.type).toBe("UpsertCodex");
			expect(actions[1]?.type).toBe("UpsertCodex");
		});

		it("generates UpsertCodex for new sections", () => {
			const root = section("Library");
			const tree = makeTreeAccessor(root);

			const impact: CodexImpact = {
				contentChanged: [[sec("Library")]],
				deleted: [],
				descendantsChanged: [],
				renamed: [],
			};

			const actions = codexImpactToActions(impact, tree);

			expect(actions.length).toBe(1);
			expect(actions[0]?.type).toBe("UpsertCodex");
		});

		it("includes correct splitPath in payload", () => {
			const root = section("Library", {
				"A﹘Section﹘": section("A"),
			});
			const tree = makeTreeAccessor(root);

			const impact: CodexImpact = {
				contentChanged: [[sec("Library"), sec("A")]],
				deleted: [],
				descendantsChanged: [],
				renamed: [],
			};

			const actions = codexImpactToActions(impact, tree);

			// Should regenerate both Library and A (ancestors are included)
			expect(actions.length).toBeGreaterThanOrEqual(2);
			const aAction = actions.find(
				(a) =>
					a.type === "UpsertCodex" &&
					a.payload.splitPath.pathParts.join("/") === "Library/A",
			);
			expect(aAction).toBeDefined();
			if (aAction?.type === "UpsertCodex") {
				expect(aAction.payload.splitPath).toEqual({
					basename: "__-A",
					extension: "md",
					pathParts: ["Library", "A"],
					type: SplitPathType.MdFile,
				});
			}
		});
	});

	describe("renamed", () => {
		it("generates DeleteCodex for new location with old suffix and UpsertCodex for new location", () => {
			const root = section("Library", {
				"NewName﹘Section﹘": section("NewName"),
			});
			const tree = makeTreeAccessor(root);

			const impact: CodexImpact = {
				contentChanged: [],
				deleted: [],
				descendantsChanged: [],
				renamed: [
					{
						newChain: [sec("Library"), sec("NewName")],
						oldChain: [sec("Library"), sec("OldName")],
					},
				],
			};

			const actions = codexImpactToActions(impact, tree);

			// Should have delete for moved codex (new location, old suffix), upsert for new location, and upsert for parent (Library)
			expect(actions.length).toBeGreaterThanOrEqual(2);
			
			const deleteAction = actions.find((a) => a.type === "DeleteCodex");
			expect(deleteAction).toBeDefined();
			if (deleteAction?.type === "DeleteCodex") {
				// Delete should target NEW location with OLD suffix
				// When Obsidian moves folder, codex moves with it but keeps old suffix
				expect(deleteAction.payload.splitPath.pathParts.join("/")).toBe("Library/NewName");
				expect(deleteAction.payload.splitPath.basename).toBe("__-OldName");
			}

			const newUpsertAction = actions.find(
				(a) =>
					a.type === "UpsertCodex" &&
					a.payload.splitPath.pathParts.join("/") === "Library/NewName",
			);
			expect(newUpsertAction).toBeDefined();
			if (newUpsertAction?.type === "UpsertCodex") {
				expect(newUpsertAction.payload.splitPath.basename).toBe("__-NewName");
			}
		});
	});

	describe("deleted", () => {
		it("generates DeleteCodex action", () => {
			const root = section("Library");
			const tree = makeTreeAccessor(root);

			const impact: CodexImpact = {
				contentChanged: [],
				deleted: [[sec("Library"), sec("A")]],
				descendantsChanged: [],
				renamed: [],
			};

			const actions = codexImpactToActions(impact, tree);

			// DeleteCodex for A, and UpsertCodex for Library (all codexes are regenerated)
			expect(actions.length).toBe(2);
			const deleteAction = actions.find((a) => a.type === "DeleteCodex");
			expect(deleteAction).toBeDefined();
			if (deleteAction?.type === "DeleteCodex") {
				expect(deleteAction.payload.splitPath.basename).toBe("__-A");
			}
		});

		it("skips contentChanged for deleted sections", () => {
			const root = section("Library");
			const tree = makeTreeAccessor(root);

			const impact: CodexImpact = {
				contentChanged: [[sec("Library"), sec("A")]], // Would be updated
				deleted: [[sec("Library"), sec("A")]], // But is deleted
				descendantsChanged: [],
				renamed: [],
			};

			const actions = codexImpactToActions(impact, tree);

			// Delete for A, and UpsertCodex for parent (Library) which is in contentChanged
			expect(actions.length).toBe(2);
			
			const deleteAction = actions.find((a) => a.type === "DeleteCodex");
			expect(deleteAction).toBeDefined();
			if (deleteAction?.type === "DeleteCodex") {
				expect(deleteAction.payload.splitPath.basename).toBe("__-A");
			}

			// Parent (Library) should be regenerated
			const libraryUpsert = actions.find(
				(a) =>
					a.type === "UpsertCodex" &&
					a.payload.splitPath.pathParts.length === 1 &&
					a.payload.splitPath.pathParts[0] === "Library",
			);
			expect(libraryUpsert).toBeDefined();
		});
	});

	describe("descendantsChanged", () => {
		it("generates UpsertCodex for descendant sections + WriteScrollStatus for scrolls", () => {
			const root = section("Library", {
				"A﹘Section﹘": section("A", {
					"B﹘Section﹘": section("B"),
					"Note﹘Scroll﹘md": scroll("Note"),
				}),
			});
			const tree = makeTreeAccessor(root);

			const impact: CodexImpact = {
				contentChanged: [],
				deleted: [],
				descendantsChanged: [
					{ newStatus: TreeNodeStatus.Done, sectionChain: [sec("Library"), sec("A")] },
				],
				renamed: [],
			};

			const actions = codexImpactToActions(impact, tree);

			// Should upsert A (the section itself) and B (descendant section of A)
			const upsertActions = actions.filter((a) => a.type === "UpsertCodex");
			expect(upsertActions.length).toBeGreaterThanOrEqual(2);
			const bAction = upsertActions.find((a) => 
				a.type === "UpsertCodex" && a.payload.splitPath.basename === "__-B-A"
			);
			expect(bAction).toBeDefined();

			// Should write status to Note (descendant scroll of A)
			const writeStatusActions = actions.filter((a) => a.type === "WriteScrollStatus");
			expect(writeStatusActions.length).toBe(1);
			expect(writeStatusActions[0]?.type).toBe("WriteScrollStatus");
			if (writeStatusActions[0]?.type === "WriteScrollStatus") {
				expect(writeStatusActions[0].payload.splitPath.basename).toBe("Note-A");
				expect(writeStatusActions[0].payload.status).toBe(TreeNodeStatus.Done);
			}
		});
	});
});
