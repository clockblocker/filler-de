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
import type { ParsedUserSettings } from "../../../../../src/global-state/parsed-settings";
import { SplitPathType } from "../../../../../src/managers/obsidian/vault-action-manager/types/split-path";

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
		it("generates UpdateCodex for each changed section", () => {
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
			expect(actions[0]?.type).toBe("UpdateCodex");
			expect(actions[1]?.type).toBe("UpdateCodex");
		});

		it("generates CreateCodex when isInit=true", () => {
			const root = section("Library");
			const tree = makeTreeAccessor(root);

			const impact: CodexImpact = {
				contentChanged: [[sec("Library")]],
				deleted: [],
				descendantsChanged: [],
				renamed: [],
			};

			const actions = codexImpactToActions(impact, tree, true);

			expect(actions.length).toBe(1);
			expect(actions[0]?.type).toBe("CreateCodex");
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

			expect(actions[0]?.type).toBe("UpdateCodex");
			if (actions[0]?.type === "UpdateCodex") {
				expect(actions[0].payload.splitPath).toEqual({
					basename: "__-A",
					extension: "md",
					pathParts: ["Library", "A"],
					type: SplitPathType.MdFile,
				});
			}
		});
	});

	describe("renamed", () => {
		it("generates RenameCodex action", () => {
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

			expect(actions.length).toBe(1);
			expect(actions[0]?.type).toBe("RenameCodex");
			if (actions[0]?.type === "RenameCodex") {
				expect(actions[0].payload.from.basename).toBe("__-OldName");
				expect(actions[0].payload.to.basename).toBe("__-NewName");
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

			expect(actions.length).toBe(1);
			expect(actions[0]?.type).toBe("DeleteCodex");
			if (actions[0]?.type === "DeleteCodex") {
				expect(actions[0].payload.splitPath.basename).toBe("__-A");
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

			// Only delete, no update
			expect(actions.length).toBe(1);
			expect(actions[0]?.type).toBe("DeleteCodex");
		});
	});

	describe("descendantsChanged", () => {
		it("generates UpdateCodex for descendant sections + WriteScrollStatus for scrolls", () => {
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

			// Should update B (descendant section of A)
			const updateActions = actions.filter((a) => a.type === "UpdateCodex");
			expect(updateActions.length).toBe(1);
			expect(updateActions[0]?.type).toBe("UpdateCodex");
			if (updateActions[0]?.type === "UpdateCodex") {
				expect(updateActions[0].payload.splitPath.basename).toBe("__-B-A");
			}

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
