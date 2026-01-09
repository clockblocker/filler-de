import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	type CodexImpact,
	computeCodexImpact,
} from "../../../../../src/commanders/librarian-new/library-tree/codex/compute-codex-impact";
import { TreeActionType } from "../../../../../src/commanders/librarian-new/library-tree/tree-action/types/tree-action";
import { TreeNodeStatus, TreeNodeType } from "../../../../../src/commanders/librarian-new/library-tree/tree-node/types/atoms";
import type { FileNodeSegmentId, ScrollNodeSegmentId, SectionNodeSegmentId } from "../../../../../src/commanders/librarian-new/library-tree/tree-node/types/node-segment-id";
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

const scroll = (name: string): ScrollNodeSegmentId =>
	`${name}﹘Scroll﹘md` as ScrollNodeSegmentId;

const file = (name: string): FileNodeSegmentId =>
	`${name}﹘File﹘png` as FileNodeSegmentId;

describe("computeCodexImpact", () => {
	describe("Create leaf", () => {
		it("impacts parent and ancestors", () => {
			const action = {
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note-B-A",
					extension: "md",
					pathParts: ["Library", "A", "B"],
					type: SplitPathType.MdFile,
				},
				targetLocator: {
					segmentId: scroll("Note"),
					segmentIdChainToParent: [sec("Library"), sec("A"), sec("B")],
					targetType: TreeNodeType.Scroll,
				},
			} as const;

			const impact = computeCodexImpact(action);

			// Parent B + ancestors A + Library
			expect(impact.contentChanged).toContainEqual([sec("Library"), sec("A"), sec("B")]);
			expect(impact.contentChanged).toContainEqual([sec("Library"), sec("A")]);
			expect(impact.contentChanged).toContainEqual([sec("Library")]);
			expect(impact.renamed).toEqual([]);
			expect(impact.deleted).toEqual([]);
		});

		it("impacts only library root for root-level leaf", () => {
			const action = {
				actionType: TreeActionType.Create,
				observedSplitPath: {
					basename: "Note",
					extension: "md",
					pathParts: ["Library"],
					type: SplitPathType.MdFile,
				},
				targetLocator: {
					segmentId: scroll("Note"),
					segmentIdChainToParent: [sec("Library")],
					targetType: TreeNodeType.Scroll,
				},
			} as const;

			const impact = computeCodexImpact(action);

			expect(impact.contentChanged).toContainEqual([sec("Library")]);
			expect(impact.contentChanged.length).toBe(1);
		});
	});

	describe("Delete leaf", () => {
		it("impacts parent and ancestors", () => {
			const action = {
				actionType: TreeActionType.Delete,
				targetLocator: {
					segmentId: scroll("Note"),
					segmentIdChainToParent: [sec("Library"), sec("A")],
					targetType: TreeNodeType.Scroll,
				},
			} as const;

			const impact = computeCodexImpact(action);

			expect(impact.contentChanged).toContainEqual([sec("Library"), sec("A")]);
			expect(impact.contentChanged).toContainEqual([sec("Library")]);
			expect(impact.deleted).toEqual([]);
		});
	});

	describe("Delete section", () => {
		it("impacts parent + marks section and descendants as deleted", () => {
			const action = {
				actionType: TreeActionType.Delete,
				targetLocator: {
					segmentId: sec("A"),
					segmentIdChainToParent: [sec("Library")],
					targetType: TreeNodeType.Section,
				},
			} as const;

			const impact = computeCodexImpact(action);

			// Parent Library needs content update
			expect(impact.contentChanged).toContainEqual([sec("Library")]);
			// Section A is deleted
			expect(impact.deleted).toContainEqual([sec("Library"), sec("A")]);
		});
	});

	describe("Rename leaf", () => {
		it("impacts parent only (no ancestors)", () => {
			const action = {
				actionType: TreeActionType.Rename,
				newNodeName: "NewNote" as NodeName,
				targetLocator: {
					segmentId: scroll("OldNote"),
					segmentIdChainToParent: [sec("Library"), sec("A")],
					targetType: TreeNodeType.Scroll,
				},
			} as const;

			const impact = computeCodexImpact(action);

			// Only parent A needs update (link text changes)
			expect(impact.contentChanged).toContainEqual([sec("Library"), sec("A")]);
			// Ancestors don't need update for leaf rename
			expect(impact.contentChanged.length).toBe(1);
		});
	});

	describe("Rename section", () => {
		it("impacts parent + marks section as renamed", () => {
			const action = {
				actionType: TreeActionType.Rename,
				newNodeName: "NewName" as NodeName,
				targetLocator: {
					segmentId: sec("OldName"),
					segmentIdChainToParent: [sec("Library")],
					targetType: TreeNodeType.Section,
				},
			} as const;

			const impact = computeCodexImpact(action);

			// Parent Library needs update
			expect(impact.contentChanged).toContainEqual([sec("Library")]);
			// Section itself is renamed (codex file moves)
			expect(impact.renamed).toContainEqual({
				newChain: [sec("Library"), sec("NewName")],
				oldChain: [sec("Library"), sec("OldName")],
			});
			// Renamed section's content also needs update (parent backlink changes)
			expect(impact.contentChanged).toContainEqual([sec("Library"), sec("NewName")]);
		});
	});

	describe("Move leaf", () => {
		it("impacts old parent + new parent + their ancestors", () => {
			const action = {
				actionType: TreeActionType.Move,
				newNodeName: "Note" as NodeName,
				newParentLocator: {
					segmentId: sec("B"),
					segmentIdChainToParent: [sec("Library")],
					targetType: TreeNodeType.Section,
				},
				observedSplitPath: {
					basename: "Note-B",
					extension: "md",
					pathParts: ["Library", "B"],
					type: SplitPathType.MdFile,
				},
				targetLocator: {
					segmentId: scroll("Note"),
					segmentIdChainToParent: [sec("Library"), sec("A")],
					targetType: TreeNodeType.Scroll,
				},
			} as const;

			const impact = computeCodexImpact(action);

			// Old parent A + Library
			expect(impact.contentChanged).toContainEqual([sec("Library"), sec("A")]);
			expect(impact.contentChanged).toContainEqual([sec("Library")]);
			// New parent B + Library (Library already included)
			expect(impact.contentChanged).toContainEqual([sec("Library"), sec("B")]);
		});
	});

	describe("Move section", () => {
		it("impacts old parent + new parent + marks section as renamed", () => {
			const action = {
				actionType: TreeActionType.Move,
				newNodeName: "Child" as NodeName,
				newParentLocator: {
					segmentId: sec("B"),
					segmentIdChainToParent: [sec("Library")],
					targetType: TreeNodeType.Section,
				},
				observedSplitPath: {
					basename: "Child",
					pathParts: ["Library", "B"],
					type: SplitPathType.Folder,
				},
				targetLocator: {
					segmentId: sec("Child"),
					segmentIdChainToParent: [sec("Library"), sec("A")],
					targetType: TreeNodeType.Section,
				},
			} as const;

			const impact = computeCodexImpact(action);

			// Old parent A + Library
			expect(impact.contentChanged).toContainEqual([sec("Library"), sec("A")]);
			// New parent B + Library
			expect(impact.contentChanged).toContainEqual([sec("Library"), sec("B")]);
			// Section moves (codex file moves)
			expect(impact.renamed).toContainEqual({
				newChain: [sec("Library"), sec("B"), sec("Child")],
				oldChain: [sec("Library"), sec("A"), sec("Child")],
			});
			// Moved section's content needs update (parent backlink changes)
			expect(impact.contentChanged).toContainEqual([sec("Library"), sec("B"), sec("Child")]);
		});
	});

	describe("ChangeStatus leaf", () => {
		it("impacts parent and ancestors", () => {
			const action = {
				actionType: TreeActionType.ChangeStatus,
				newStatus: TreeNodeStatus.Done,
				targetLocator: {
					segmentId: scroll("Note"),
					segmentIdChainToParent: [sec("Library"), sec("A")],
					targetType: TreeNodeType.Scroll,
				},
			} as const;

			const impact = computeCodexImpact(action);

			// Parent A + Library (aggregated status may change)
			expect(impact.contentChanged).toContainEqual([sec("Library"), sec("A")]);
			expect(impact.contentChanged).toContainEqual([sec("Library")]);
		});
	});

	describe("ChangeStatus section", () => {
		it("impacts section + all ancestors + descendants", () => {
			const action = {
				actionType: TreeActionType.ChangeStatus,
				newStatus: TreeNodeStatus.Done,
				targetLocator: {
					segmentId: sec("A"),
					segmentIdChainToParent: [sec("Library")],
					targetType: TreeNodeType.Section,
				},
			} as const;

			const impact = computeCodexImpact(action);

			// Section A + Library
			expect(impact.contentChanged).toContainEqual([sec("Library"), sec("A")]);
			expect(impact.contentChanged).toContainEqual([sec("Library")]);
			// Note: descendants are marked as needing update via descendantsChanged
			expect(impact.descendantsChanged).toContainEqual({
				newStatus: TreeNodeStatus.Done,
				sectionChain: [sec("Library"), sec("A")],
			});
		});
	});
});
