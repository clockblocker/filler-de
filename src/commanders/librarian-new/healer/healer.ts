import { ok, type Result } from "neverthrow";
import { SplitPathKind } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type { NodeName } from "../types/schemas/node-name";
import type { Codecs } from "./library-tree/codecs";
import type { CodecError } from "./library-tree/codecs/errors";
import type { TreeAccessor } from "./library-tree/codex/codex-impact-to-actions";
import {
	type CodexImpact,
	computeCodexImpact,
} from "./library-tree/codex/compute-codex-impact";
import type { Tree } from "./library-tree/tree";
import type {
	SplitPathInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "./library-tree/tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
} from "./library-tree/tree-action/types/target-chains";
import type {
	ChangeNodeStatusAction,
	CreateTreeLeafAction,
	DeleteNodeAction,
	MoveNodeAction,
	RenameNodeAction,
	TreeAction,
} from "./library-tree/tree-action/types/tree-action";
import { makeNodeSegmentId } from "./library-tree/tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeKind } from "./library-tree/tree-node/types/atoms";
import type {
	SectionNodeSegmentId,
	TreeNodeSegmentId,
} from "./library-tree/tree-node/types/node-segment-id";
import type {
	FileNode,
	ScrollNode,
	SectionNode,
	TreeNode,
} from "./library-tree/tree-node/types/tree-node";
import type { HealingAction } from "./library-tree/types/healing-action";

// ─── Result Type ───

export type { CodexImpact };

export type ApplyResult = {
	healingActions: HealingAction[];
	codexImpact: CodexImpact;
};

// ─── Healer ───

export class Healer implements TreeAccessor {
	private tree: Tree;
	private codecs: Codecs;

	constructor(tree: Tree, codecs: Codecs) {
		this.tree = tree;
		this.codecs = codecs;
	}

	/** Main entry: apply action, return healing actions + codex impact */
	getHealingActionsFor(action: TreeAction): ApplyResult {
		// Compute codex impact BEFORE applying (uses action locators)
		const codexImpact = computeCodexImpact(action);

		// Apply action to tree (modifies tree structure)
		this.tree.apply(action);

		// Compute healing actions based on action type
		const healingActions = this.computeHealingForAction(action);

		return { codexImpact, healingActions };
	}

	// ─── TreeAccessor Implementation ───

	findSection(chain: SectionNodeSegmentId[]): SectionNode | undefined {
		return this.tree.findSection(chain);
	}

	getRoot(): SectionNode {
		return this.tree.getRoot();
	}

	// ─── Healing Computation ───

	private computeHealingForAction(action: TreeAction): HealingAction[] {
		const actionType = action.actionType;

		if (actionType === "Create") {
			return this.computeCreateHealing(action as CreateTreeLeafAction);
		}
		if (actionType === "Delete") {
			return this.computeDeleteHealing(action as DeleteNodeAction);
		}
		if (actionType === "Rename") {
			return this.computeRenameHealing(action as RenameNodeAction);
		}
		if (actionType === "Move") {
			return this.computeMoveHealing(action as MoveNodeAction);
		}
		// ChangeStatus
		return this.computeChangeStatusHealing(
			action as ChangeNodeStatusAction,
		);
	}

	private computeCreateHealing(
		action: CreateTreeLeafAction,
	): HealingAction[] {
		const { targetLocator, observedSplitPath } = action;
		return this.computeLeafHealing(targetLocator, observedSplitPath);
	}

	private computeDeleteHealing(_action: DeleteNodeAction): HealingAction[] {
		// Delete doesn't generate healing actions
		return [];
	}

	private computeRenameHealing(action: RenameNodeAction): HealingAction[] {
		const { targetLocator, newNodeName } = action;

		// Get node after tree.apply() (already renamed)
		const parentSection = this.tree.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!parentSection) return [];

		// Find node by newNodeName (tree already renamed it)
		let node: TreeNode | null = null;
		for (const child of Object.values(parentSection.children)) {
			if (child.nodeName === newNodeName) {
				node = child;
				break;
			}
		}
		if (!node) return [];

		// Compute new segment ID
		const newSegmentId = this.makeSegmentIdFromNode(node);

		// If section renamed, update descendant suffixes
		if (node.kind === TreeNodeKind.Section) {
			// Old path: parent chain + OLD section name (from targetLocator.segmentId)
			const oldSectionPath = this.buildSectionPath(
				targetLocator.segmentIdChainToParent,
				this.extractNodeNameFromSegmentId(
					targetLocator.segmentId as SectionNodeSegmentId,
				),
			);
			// New chain in tree (where section IS now)
			const newSectionChain = [
				...targetLocator.segmentIdChainToParent,
				newSegmentId as SectionNodeSegmentId,
			];
			// Current path in filesystem: parent chain + NEW section name
			const currentSectionPath = this.buildSectionPath(
				targetLocator.segmentIdChainToParent,
				newNodeName,
			);
			return this.computeDescendantSuffixHealing(
				newSectionChain,
				node,
				oldSectionPath,
				currentSectionPath,
			);
		}

		// Leaf rename needs observed path - but rename action doesn't carry it
		// The observed path IS the canonical path before rename (tree was in sync)
		const oldCanonicalResult =
			this.buildCanonicalLeafSplitPathFromOldLocator(
				targetLocator as ScrollNodeLocator | FileNodeLocator,
			);
		if (oldCanonicalResult.isErr()) {
			// Error indicates bug in tree structure - propagate by throwing
			throw new Error(
				`Failed to build canonical split path from old locator: ${oldCanonicalResult.error.message}`,
			);
		}
		const oldCanonical = oldCanonicalResult.value;
		const newLocator = {
			...targetLocator,
			segmentId: newSegmentId,
		} as ScrollNodeLocator | FileNodeLocator;

		return this.computeLeafHealing(newLocator, oldCanonical);
	}

	private computeMoveHealing(action: MoveNodeAction): HealingAction[] {
		const {
			targetLocator,
			newParentLocator,
			newNodeName,
			observedSplitPath,
		} = action;

		// Get node from tree (tree already moved it)
		const newParentChain = [
			...newParentLocator.segmentIdChainToParent,
			newParentLocator.segmentId,
		];
		const newParent = this.tree.findSection(newParentChain);
		if (!newParent) return [];

		// Find node by newNodeName (tree already moved and renamed it)
		let node: TreeNode | null = null;
		for (const child of Object.values(newParent.children)) {
			if (child.nodeName === newNodeName) {
				node = child;
				break;
			}
		}
		if (!node) return [];

		// Compute old section path (before move) - use old node name from targetLocator
		const oldNodeName = this.extractNodeNameFromSegmentId(
			targetLocator.segmentId as SectionNodeSegmentId,
		);
		const oldSectionPath =
			node.kind === TreeNodeKind.Section
				? this.buildSectionPath(
						targetLocator.segmentIdChainToParent,
						oldNodeName,
					)
				: null;

		// Compute healing
		if (node.kind === TreeNodeKind.Section && oldSectionPath) {
			// New chain in tree
			const newSegmentId = this.makeSegmentIdFromNode(node);
			const newSectionChain = [
				...newParentChain,
				newSegmentId as SectionNodeSegmentId,
			];
			// Canonical path: parent chain + new node name
			const canonicalSectionPath = [
				...newParentChain.map((segId) =>
					this.extractNodeNameFromSegmentId(segId),
				),
				newNodeName,
			];
			// Current path in filesystem (from observed)
			const currentSectionPath = [
				...observedSplitPath.pathParts,
				observedSplitPath.basename,
			];

			const healingActions: HealingAction[] = [];

			// 1) Heal the folder itself if observed != canonical
			const observedFolderPath = currentSectionPath.join("/");
			const canonicalFolderPath = canonicalSectionPath.join("/");
			if (observedFolderPath !== canonicalFolderPath) {
				healingActions.push({
					kind: "RenameFolder",
					payload: {
						from: {
							basename: observedSplitPath.basename,
							kind: SplitPathKind.Folder,
							pathParts: observedSplitPath.pathParts,
						},
						to: {
							basename: newNodeName,
							kind: SplitPathKind.Folder,
							pathParts: canonicalSectionPath.slice(0, -1),
						},
					},
				});
			}

			// 2) Heal descendants (they will move with folder, but suffixes need update)
			// After folder heals, descendants are at canonicalSectionPath
			const descendantHealing = this.computeDescendantSuffixHealing(
				newSectionChain,
				node,
				oldSectionPath,
				canonicalSectionPath, // after folder heals, files are here
			);

			return [...healingActions, ...descendantHealing];
		}

		// Leaf move - narrow the types
		const newSegmentId = this.makeSegmentIdFromNode(node);
		if (node.kind === TreeNodeKind.Scroll) {
			const newLocator: ScrollNodeLocator = {
				segmentId: newSegmentId as ScrollNodeLocator["segmentId"],
				segmentIdChainToParent: newParentChain,
				targetKind: TreeNodeKind.Scroll,
			};
			return this.computeLeafHealing(
				newLocator,
				observedSplitPath as SplitPathToMdFileInsideLibrary,
			);
		}

		// File
		const newLocator: FileNodeLocator = {
			segmentId: newSegmentId as FileNodeLocator["segmentId"],
			segmentIdChainToParent: newParentChain,
			targetKind: TreeNodeKind.File,
		};
		return this.computeLeafHealing(
			newLocator,
			observedSplitPath as SplitPathToFileInsideLibrary,
		);
	}

	private computeChangeStatusHealing(
		_action: ChangeNodeStatusAction,
	): HealingAction[] {
		// ChangeStatus doesn't generate healing actions
		return [];
	}

	private computeLeafHealing(
		locator: ScrollNodeLocator | FileNodeLocator,
		observedSplitPath:
			| SplitPathToMdFileInsideLibrary
			| SplitPathToFileInsideLibrary,
	): HealingAction[] {
		const canonicalSplitPathResult =
			this.buildCanonicalLeafSplitPath(locator);
		if (canonicalSplitPathResult.isErr()) {
			// Error indicates bug in tree structure - propagate by throwing
			throw new Error(
				`Failed to build canonical split path: ${canonicalSplitPathResult.error.message}`,
			);
		}
		const canonicalSplitPath = canonicalSplitPathResult.value;
		const healingActions: HealingAction[] = [];

		if (!this.splitPathsEqual(observedSplitPath, canonicalSplitPath)) {
			if (observedSplitPath.kind === SplitPathKind.MdFile) {
				healingActions.push({
					kind: "RenameMdFile",
					payload: {
						from: observedSplitPath,
						to: canonicalSplitPath as SplitPathToMdFileInsideLibrary,
					},
				});
			} else {
				healingActions.push({
					kind: "RenameFile",
					payload: {
						from: observedSplitPath as SplitPathToFileInsideLibrary,
						to: canonicalSplitPath as SplitPathToFileInsideLibrary,
					},
				});
			}
		}

		return healingActions;
	}

	/**
	 * Compute healing for all descendants after section rename/move.
	 *
	 * @param sectionChain - NEW chain to the section (where it IS now in tree)
	 * @param section - the section node
	 * @param oldSuffixPathParts - OLD path parts (for computing old basename suffix)
	 * @param currentPathParts - NEW path parts (where files ARE now in filesystem)
	 *                           If undefined, derived from sectionChain.
	 */
	private computeDescendantSuffixHealing(
		sectionChain: SectionNodeSegmentId[],
		section: SectionNode,
		oldSuffixPathParts: string[],
		currentPathParts?: string[],
	): HealingAction[] {
		// Derive current path from sectionChain if not provided
		const actualCurrentPath =
			currentPathParts ??
			sectionChain.map((segId) =>
				this.extractNodeNameFromSegmentId(segId),
			);

		const healingActions: HealingAction[] = [];

		for (const [segId, child] of Object.entries(section.children)) {
			if (child.kind === TreeNodeKind.Section) {
				// Recurse with extended paths
				const childOldSuffixPath = [
					...oldSuffixPathParts,
					child.nodeName,
				];
				const childCurrentPath = [...actualCurrentPath, child.nodeName];
				const childHealing = this.computeDescendantSuffixHealing(
					[...sectionChain, segId as SectionNodeSegmentId],
					child,
					childOldSuffixPath,
					childCurrentPath,
				);
				healingActions.push(...childHealing);
			} else {
				// Leaf: derive observed path from parent + leaf basename
				const locator: ScrollNodeLocator | FileNodeLocator = {
					segmentId: segId as TreeNodeSegmentId,
					segmentIdChainToParent: sectionChain,
					targetKind: child.kind,
				} as ScrollNodeLocator | FileNodeLocator;

				// Build observed split path for this leaf
				// - basename uses OLD suffix (what the file WAS named)
				// - pathParts uses CURRENT path (where the file IS now)
				const observedSplitPath = this.buildObservedLeafSplitPath(
					child,
					oldSuffixPathParts,
					actualCurrentPath,
				);

				const leafHealing = this.computeLeafHealing(
					locator,
					observedSplitPath,
				);
				healingActions.push(...leafHealing);
			}
		}

		return healingActions;
	}

	/**
	 * Build the "observed" split path for a leaf after section rename/move.
	 *
	 * @param leaf - the leaf node
	 * @param oldSuffixPathParts - OLD path (for computing old basename suffix)
	 * @param currentPathParts - NEW path (where file IS now in filesystem)
	 */
	private buildObservedLeafSplitPath(
		leaf: ScrollNode | FileNode,
		oldSuffixPathParts: string[],
		currentPathParts: string[],
	): SplitPathToMdFileInsideLibrary | SplitPathToFileInsideLibrary {
		// Suffix from OLD path (what the file WAS named)
		const suffixParts =
			this.codecs.canonicalSplitPath.pathPartsWithRootToSuffixParts(
				oldSuffixPathParts,
			);

		const basename =
			this.codecs.canonicalSplitPath.serializeSeparatedSuffix({
				coreName: leaf.nodeName,
				suffixParts,
			});

		// pathParts = CURRENT path (where file IS now)
		if (leaf.kind === TreeNodeKind.Scroll) {
			return {
				basename,
				extension: "md",
				kind: SplitPathKind.MdFile,
				pathParts: currentPathParts,
			};
		}

		return {
			basename,
			extension: leaf.extension,
			kind: SplitPathKind.File,
			pathParts: currentPathParts,
		};
	}

	private buildCanonicalLeafSplitPath(
		locator: ScrollNodeLocator | FileNodeLocator,
	): Result<
		SplitPathToMdFileInsideLibrary | SplitPathToFileInsideLibrary,
		CodecError
	> {
		// Convert locator to canonical split path, then to split path
		return this.codecs.locator
			.locatorToCanonicalSplitPathInsideLibrary(locator)
			.andThen((canonical) => {
				// Convert canonical to split path
				const splitPath =
					this.codecs.canonicalSplitPath.fromCanonicalSplitPathInsideLibrary(
						canonical,
					);

				return ok(
					splitPath as
						| SplitPathToMdFileInsideLibrary
						| SplitPathToFileInsideLibrary,
				);
			});
	}

	private buildCanonicalLeafSplitPathFromOldLocator(
		locator: ScrollNodeLocator | FileNodeLocator,
	): Result<
		SplitPathToMdFileInsideLibrary | SplitPathToFileInsideLibrary,
		CodecError
	> {
		// Same as buildCanonicalLeafSplitPath but uses the locator as-is
		// (before any modifications)
		return this.buildCanonicalLeafSplitPath(locator);
	}

	private buildSectionPath(
		parentChain: SectionNodeSegmentId[],
		sectionName: NodeName,
	): string[] {
		// parentChain already includes Library root
		return [
			...parentChain.map((segId) =>
				this.extractNodeNameFromSegmentId(segId),
			),
			sectionName,
		];
	}

	private extractNodeNameFromSegmentId(
		segId: SectionNodeSegmentId,
	): NodeName {
		const parseResult = this.codecs.segmentId.parseSectionSegmentId(segId);
		if (parseResult.isErr()) {
			throw new Error(
				`Invalid section segment ID: ${parseResult.error.message}`,
			);
		}
		return parseResult.value.coreName;
	}

	private splitPathsEqual(
		a: SplitPathInsideLibrary,
		b: SplitPathInsideLibrary,
	): boolean {
		if (a.kind !== b.kind) return false;
		if (a.basename !== b.basename) return false;
		if (a.pathParts.length !== b.pathParts.length) return false;
		for (let i = 0; i < a.pathParts.length; i++) {
			if (a.pathParts[i] !== b.pathParts[i]) return false;
		}
		if (
			"extension" in a &&
			"extension" in b &&
			a.extension !== b.extension
		) {
			return false;
		}
		return true;
	}

	private makeSegmentIdFromNode(node: TreeNode): TreeNodeSegmentId {
		// Type narrowing for makeNodeSegmentId overloads
		if (node.kind === TreeNodeKind.Section) {
			return makeNodeSegmentId(node);
		}
		if (node.kind === TreeNodeKind.Scroll) {
			return makeNodeSegmentId(node);
		}
		return makeNodeSegmentId(node);
	}
}
