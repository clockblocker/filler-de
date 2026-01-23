import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	makeCodecRulesFromSettings,
	makeCodecs,
} from "../../../../../src/commanders/librarian/codecs";
import type {
	SectionNodeSegmentId,
} from "../../../../../src/commanders/librarian/codecs/segment-id/types/segment-id";
import {
	codexImpactToDeletions,
	codexImpactToRecreations,
} from "../../../../../src/commanders/librarian/healer/library-tree/codex/codex-impact-to-actions";
import type { CodexImpact } from "../../../../../src/commanders/librarian/healer/library-tree/codex/compute-codex-impact";
import type { TreeReader } from "../../../../../src/commanders/librarian/healer/library-tree/tree-interfaces";
import {
	TreeNodeKind,
	TreeNodeStatus,
} from "../../../../../src/commanders/librarian/healer/library-tree/tree-node/types/atoms";
import type {
	ScrollNode,
	SectionNode,
} from "../../../../../src/commanders/librarian/healer/library-tree/tree-node/types/tree-node";
import type { NodeName } from "../../../../../src/commanders/librarian/types/schemas/node-name";
import { MD } from "../../../../../src/managers/obsidian/vault-action-manager/types/literals";
import { defaultSettingsForUnitTests } from "../../../common-utils/consts";
import { setupGetParsedUserSettingsSpy } from "../../../common-utils/setup-spy";

let getParsedUserSettingsSpy: ReturnType<typeof spyOn>;
let codecs: ReturnType<typeof makeCodecs>;

beforeEach(() => {
	getParsedUserSettingsSpy = setupGetParsedUserSettingsSpy();
	const rules = makeCodecRulesFromSettings(defaultSettingsForUnitTests);
	codecs = makeCodecs(rules);
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
	extension: MD,
	kind: TreeNodeKind.Scroll,
	nodeName: name as NodeName,
	status,
});

const section = (
	name: string,
	children: Record<string, SectionNode | ScrollNode> = {},
): SectionNode => ({
	children: children as SectionNode["children"],
	kind: TreeNodeKind.Section,
	nodeName: name as NodeName,
});

function makeTreeAccessor(root: SectionNode): TreeReader {
	return {
		findSection(chain: SectionNodeSegmentId[]): SectionNode | undefined {
			if (chain.length === 0) return undefined;
			if (chain.length === 1) return root;

			let current: SectionNode = root;
			for (let i = 1; i < chain.length; i++) {
				const segId = chain[i];
				if (!segId) return undefined;
				const child = current.children[segId];
				if (!child || child.kind !== TreeNodeKind.Section) return undefined;
				current = child;
			}
			return current;
		},
		getRoot() {
			return root;
		},
	};
}

describe("codexImpactToDeletions", () => {
	describe("deleted", () => {
		it("generates DeleteMdFile for deleted sections", () => {
			const root = section("Library");
			const tree = makeTreeAccessor(root);

			const impact: CodexImpact = {
				contentChanged: [],
				deleted: [[sec("Library"), sec("A")]],
				descendantsChanged: [],
				impactedChains: new Set(),
				renamed: [],
			};

			const actions = codexImpactToDeletions(impact, tree, codecs);

			expect(actions.length).toBe(1);
			const deleteAction = actions.find((a) => a.kind === "DeleteMdFile");
			expect(deleteAction).toBeDefined();
			if (deleteAction?.kind === "DeleteMdFile") {
				expect(deleteAction.payload.splitPath.basename).toBe("__-A");
			}
		});
	});

	describe("renamed", () => {
		it("generates DeleteMdFile for new location with old suffix", () => {
			const root = section("Library", {
				"NewName﹘Section﹘": section("NewName"),
			});
			const tree = makeTreeAccessor(root);

			const impact: CodexImpact = {
				contentChanged: [],
				deleted: [],
				descendantsChanged: [],
				impactedChains: new Set(),
				renamed: [
					{
						newChain: [sec("Library"), sec("NewName")],
						oldChain: [sec("Library"), sec("OldName")],
					},
				],
			};

			const actions = codexImpactToDeletions(impact, tree, codecs);

			expect(actions.length).toBe(1);
			const deleteAction = actions.find((a) => a.kind === "DeleteMdFile");
			expect(deleteAction).toBeDefined();
			if (deleteAction?.kind === "DeleteMdFile") {
				// Delete should target NEW location with OLD suffix
				expect(deleteAction.payload.splitPath.pathParts.join("/")).toBe(
					"Library/NewName",
				);
				expect(deleteAction.payload.splitPath.basename).toBe("__-OldName");
			}
		});

		it("generates DeleteMdFile for renamed section and its descendants", () => {
			const root = section("Library", {
				"NewName﹘Section﹘": section("NewName", {
					"Child﹘Section﹘": section("Child"),
				}),
			});
			const tree = makeTreeAccessor(root);

			const impact: CodexImpact = {
				contentChanged: [],
				deleted: [],
				descendantsChanged: [],
				impactedChains: new Set(),
				renamed: [
					{
						newChain: [sec("Library"), sec("NewName")],
						oldChain: [sec("Library"), sec("OldName")],
					},
				],
			};

			const actions = codexImpactToDeletions(impact, tree, codecs);

			// Should delete both the renamed section and its descendant
			expect(actions.length).toBe(2);
			const parentDelete = actions.find(
				(a) =>
					a.kind === "DeleteMdFile" &&
					a.payload.splitPath.pathParts.join("/") === "Library/NewName" &&
					a.payload.splitPath.basename === "__-OldName",
			);
			expect(parentDelete).toBeDefined();

			const childDelete = actions.find(
				(a) =>
					a.kind === "DeleteMdFile" &&
					a.payload.splitPath.pathParts.join("/") ===
						"Library/NewName/Child" &&
					a.payload.splitPath.basename === "__-Child-OldName",
			);
			expect(childDelete).toBeDefined();
		});
	});
});

describe("codexImpactToRecreations", () => {
	it("generates separated codex actions for all sections", () => {
		const root = section("Library", {
			"A﹘Section﹘": section("A"),
		});
		const tree = makeTreeAccessor(root);

		const impact: CodexImpact = {
			contentChanged: [],
			deleted: [],
			descendantsChanged: [],
			impactedChains: new Set(),
			renamed: [],
		};

		const actions = codexImpactToRecreations(impact, tree, codecs);

		// Should generate actions for all sections:
		// Library (root): EnsureCodexFileExists + ProcessCodex
		// A: EnsureCodexFileExists + ProcessCodex
		// Total: 2 + 2 = 4 actions
		expect(actions.length).toBe(4);

		// Library codex: ensure exists
		const libraryEnsure = actions.find(
			(a) =>
				a.kind === "EnsureCodexFileExists" &&
				a.payload.splitPath.pathParts.length === 1 &&
				a.payload.splitPath.pathParts[0] === "Library",
		);
		expect(libraryEnsure).toBeDefined();

		// Library codex: process (combined backlink + content)
		const libraryProcess = actions.find(
			(a) =>
				a.kind === "ProcessCodex" &&
				a.payload.splitPath.pathParts.length === 1 &&
				a.payload.splitPath.pathParts[0] === "Library",
		);
		expect(libraryProcess).toBeDefined();

		// A codex: ensure exists
		const aEnsure = actions.find(
			(a) =>
				a.kind === "EnsureCodexFileExists" &&
				a.payload.splitPath.pathParts.join("/") === "Library/A",
		);
		expect(aEnsure).toBeDefined();

		// A codex: process (combined backlink + content)
		const aProcess = actions.find(
			(a) =>
				a.kind === "ProcessCodex" &&
				a.payload.splitPath.pathParts.join("/") === "Library/A",
		);
		expect(aProcess).toBeDefined();
	});

	it("generates WriteScrollStatus for descendant scrolls", () => {
		const root = section("Library", {
			"A﹘Section﹘": section("A", {
				"scroll1﹘Scroll﹘md": scroll("scroll1", TreeNodeStatus.Done),
			}),
		});
		const tree = makeTreeAccessor(root);

		const impact: CodexImpact = {
			contentChanged: [],
			deleted: [],
			descendantsChanged: [
				{
					newStatus: TreeNodeStatus.Done,
					sectionChain: [sec("Library"), sec("A")],
				},
			],
			impactedChains: new Set(),
			renamed: [],
		};

		const actions = codexImpactToRecreations(impact, tree, codecs);

		// Should have UpsertCodex for Library and A, plus WriteScrollStatus for scroll1
		expect(actions.length).toBeGreaterThanOrEqual(3);
		const writeStatus = actions.find(
			(a) =>
				a.kind === "WriteScrollStatus" &&
				a.payload.splitPath.pathParts.join("/") === "Library/A" &&
				a.payload.splitPath.basename.startsWith("scroll1"),
		);
		expect(writeStatus).toBeDefined();
		if (writeStatus?.kind === "WriteScrollStatus") {
			expect(writeStatus.payload.status).toBe(TreeNodeStatus.Done);
			// Scroll basename includes parent section suffix (e.g., "scroll1-A")
			expect(writeStatus.payload.splitPath.basename).toContain("scroll1");
		}
	});
});
