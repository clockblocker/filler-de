import { SplitPathType } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import { logger } from "../../../utils/logger";
import type { NodeName } from "../types/schemas/node-name";
import {
	type CodexImpact,
	computeCodexImpact,
} from "./codex/compute-codex-impact";
import type {
	SplitPathInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "./tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
} from "./tree-action/types/target-chains";
import type {
	ChangeNodeStatusAction,
	CreateTreeLeafAction,
	DeleteNodeAction,
	MoveNodeAction,
	RenameNodeAction,
	TreeAction,
} from "./tree-action/types/tree-action";
import {
	makeJoinedSuffixedBasename,
	makeSuffixPartsFromPathPartsWithRoot,
} from "./tree-action/utils/canonical-naming/suffix-utils/core-suffix-utils";
import { getNodeName } from "./tree-action/utils/locator/locator-utils";
import { makeNodeSegmentId } from "./tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeStatus, TreeNodeType } from "./tree-node/types/atoms";
import {
	type FileNodeSegmentId,
	NodeSegmentIdSeparator,
	type ScrollNodeSegmentId,
	type SectionNodeSegmentId,
	type TreeNodeSegmentId,
} from "./tree-node/types/node-segment-id";
import type {
	FileNode,
	LeafNode,
	ScrollNode,
	SectionNode,
	TreeNode,
} from "./tree-node/types/tree-node";
import type { HealingAction } from "./types/healing-action";

// ─── Helpers ───

/** Helper to make segment ID with proper type narrowing */
function makeSegmentId(node: ScrollNode): ScrollNodeSegmentId;
function makeSegmentId(node: FileNode): FileNodeSegmentId;
function makeSegmentId(node: SectionNode): SectionNodeSegmentId;
function makeSegmentId(node: TreeNode): TreeNodeSegmentId;
function makeSegmentId(node: TreeNode): TreeNodeSegmentId {
	if (node.type === TreeNodeType.Section) {
		return makeNodeSegmentId(node);
	}
	if (node.type === TreeNodeType.Scroll) {
		return makeNodeSegmentId(node);
	}
	return makeNodeSegmentId(node);
}

// ─── Result Type ───

export type { CodexImpact };

export type ApplyResult = {
	healingActions: HealingAction[];
	codexImpact: CodexImpact;
};

// ─── TreeAccessor ───

import type { TreeAccessor } from "./codex/codex-impact-to-actions";

// ─── LibraryTree ───

export class LibraryTree implements TreeAccessor {
	private root: SectionNode;

	constructor(libraryRootName: NodeName) {
		this.root = {
			children: {},
			nodeName: libraryRootName,
			type: TreeNodeType.Section,
		};
	}

	/** Main entry: apply action, return healing actions + codex impact */
	apply(action: TreeAction): ApplyResult {
		// Compute codex impact BEFORE applying (uses action locators)
		const codexImpact = computeCodexImpact(action);

		const actionType = action.actionType;
		let healingActions: HealingAction[];

		if (actionType === "Create") {
			healingActions = this.applyCreate(action as CreateTreeLeafAction);
		} else if (actionType === "Delete") {
			healingActions = this.applyDelete(action as DeleteNodeAction);
		} else if (actionType === "Rename") {
			healingActions = this.applyRename(action as RenameNodeAction);
		} else if (actionType === "Move") {
			healingActions = this.applyMove(action as MoveNodeAction);
		} else {
			// ChangeStatus
			healingActions = this.applyChangeStatus(
				action as ChangeNodeStatusAction,
			);
		}

		return { codexImpact, healingActions };
	}

	// ─── Create ───

	private applyCreate(action: CreateTreeLeafAction): HealingAction[] {
		const { targetLocator, observedSplitPath } = action;
		const parentSection = this.ensureSectionChain(
			targetLocator.segmentIdChainToParent,
		);

		const node = this.makeLeafNode(action);
		const segmentId = makeSegmentId(node);
		parentSection.children[segmentId] = node;

		return this.computeLeafHealing(targetLocator, observedSplitPath);
	}

	private makeLeafNode(action: CreateTreeLeafAction): LeafNode {
		const nodeName = getNodeName(action.targetLocator);

		if (action.targetLocator.targetType === TreeNodeType.Scroll) {
			return {
				extension: "md",
				nodeName,
				status: action.initialStatus ?? TreeNodeStatus.NotStarted,
				type: TreeNodeType.Scroll,
			};
		}
		// File
		return {
			extension: action.observedSplitPath.extension,
			nodeName,
			status: TreeNodeStatus.Unknown,
			type: TreeNodeType.File,
		};
	}

	// ─── Delete ───

	private applyDelete(action: DeleteNodeAction): HealingAction[] {
		const { targetLocator } = action;
		const parentSection = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!parentSection) return [];

		delete parentSection.children[targetLocator.segmentId];

		// Auto-prune empty ancestors
		this.pruneEmptyAncestors(targetLocator.segmentIdChainToParent);

		return [];
	}

	private pruneEmptyAncestors(chain: SectionNodeSegmentId[]): void {
		// Walk from deepest to shallowest
		for (let i = chain.length - 1; i >= 0; i--) {
			const parentChain = chain.slice(0, i);
			const segmentId = chain[i];
			if (!segmentId) continue;

			const parent = this.findSection(parentChain);
			if (!parent) break;

			const child = parent.children[segmentId];
			if (
				child &&
				child.type === TreeNodeType.Section &&
				Object.keys(child.children).length === 0
			) {
				delete parent.children[segmentId];
			} else {
				break; // Stop if non-empty
			}
		}
	}

	// ─── Rename ───

	private applyRename(action: RenameNodeAction): HealingAction[] {
		const { targetLocator, newNodeName } = action;
		const parentSection = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!parentSection) return [];

		const node = parentSection.children[targetLocator.segmentId];
		if (!node) return [];

		// Remove old, insert with new name
		delete parentSection.children[targetLocator.segmentId];
		node.nodeName = newNodeName;
		const newSegmentId = makeSegmentId(node);
		parentSection.children[newSegmentId] = node;

		// If section renamed, update descendant suffixes
		if (node.type === TreeNodeType.Section) {
			// Old path: parent chain + OLD section name (for suffix computation)
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
		const oldCanonical = this.buildCanonicalLeafSplitPathFromOldLocator(
			targetLocator as ScrollNodeLocator | FileNodeLocator,
		);
		const newLocator = {
			...targetLocator,
			segmentId: newSegmentId,
		} as ScrollNodeLocator | FileNodeLocator;

		return this.computeLeafHealing(newLocator, oldCanonical);
	}

	// ─── Move ───

	private applyMove(action: MoveNodeAction): HealingAction[] {
		const {
			targetLocator,
			newParentLocator,
			newNodeName,
			observedSplitPath,
		} = action;

		// Detach from old parent
		const oldParent = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		logger.info("[LibraryTree] applyMove:", {
			oldParentChildren: oldParent ? Object.keys(oldParent.children) : [],
			oldParentFound: !!oldParent,
			targetLocator,
		});
		if (!oldParent) return [];

		const node = oldParent.children[targetLocator.segmentId];
		logger.info("[LibraryTree] applyMove node:", {
			nodeChildren:
				node?.type === TreeNodeType.Section
					? Object.keys(node.children)
					: "N/A",
			nodeFound: !!node,
			nodeType: node?.type,
			segmentId: targetLocator.segmentId,
		});
		if (!node) return [];

		// Compute old section path BEFORE detaching (for descendant healing)
		const oldSectionPath =
			node.type === TreeNodeType.Section
				? this.buildSectionPath(
						targetLocator.segmentIdChainToParent,
						node.nodeName,
					)
				: null;

		delete oldParent.children[targetLocator.segmentId];

		// Prune old ancestors if empty
		this.pruneEmptyAncestors(targetLocator.segmentIdChainToParent);

		// Ensure new parent chain exists
		const newParentChain = [
			...newParentLocator.segmentIdChainToParent,
			newParentLocator.segmentId,
		];
		const newParent = this.ensureSectionChain(newParentChain);

		// Update node name and attach
		node.nodeName = newNodeName;
		const newSegmentId = makeSegmentId(node);
		newParent.children[newSegmentId] = node;

		// Compute healing
		if (node.type === TreeNodeType.Section && oldSectionPath) {
			// New chain in tree
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
			logger.info("[LibraryTree] Section move healing:", {
				canonicalSectionPath,
				childCount: Object.keys(node.children).length,
				currentSectionPath,
				newParentChain,
				newSegmentId,
				oldSectionPath,
			});

			const healingActions: HealingAction[] = [];

			// 1) Heal the folder itself if observed != canonical
			const observedFolderPath = currentSectionPath.join("/");
			const canonicalFolderPath = canonicalSectionPath.join("/");
			if (observedFolderPath !== canonicalFolderPath) {
				healingActions.push({
					payload: {
						from: {
							basename: observedSplitPath.basename,
							pathParts: observedSplitPath.pathParts,
							type: SplitPathType.Folder,
						},
						to: {
							basename: newNodeName,
							pathParts: canonicalSectionPath.slice(0, -1),
							type: SplitPathType.Folder,
						},
					},
					type: "RenameFolder",
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
		if (node.type === TreeNodeType.Scroll) {
			const newLocator: ScrollNodeLocator = {
				segmentId: newSegmentId as ScrollNodeSegmentId,
				segmentIdChainToParent: newParentChain,
				targetType: TreeNodeType.Scroll,
			};
			return this.computeLeafHealing(
				newLocator,
				observedSplitPath as SplitPathToMdFileInsideLibrary,
			);
		}

		// File
		const newLocator: FileNodeLocator = {
			segmentId: newSegmentId as FileNodeSegmentId,
			segmentIdChainToParent: newParentChain,
			targetType: TreeNodeType.File,
		};
		return this.computeLeafHealing(
			newLocator,
			observedSplitPath as SplitPathToFileInsideLibrary,
		);
	}

	// ─── ChangeStatus ───

	private applyChangeStatus(action: ChangeNodeStatusAction): HealingAction[] {
		const { targetLocator, newStatus } = action;

		if (targetLocator.targetType === TreeNodeType.Section) {
			// Propagate to descendants
			const section = this.findSection([
				...targetLocator.segmentIdChainToParent,
				targetLocator.segmentId,
			]);
			if (section) {
				this.propagateStatus(section, newStatus);
			}
		} else {
			// Direct leaf update
			const parent = this.findSection(
				targetLocator.segmentIdChainToParent,
			);
			if (parent) {
				const node = parent.children[targetLocator.segmentId];
				if (node && node.type !== TreeNodeType.Section) {
					(node as ScrollNode).status = newStatus;
				}
			}
		}

		return [];
	}

	private propagateStatus(
		section: SectionNode,
		status: TreeNodeStatus,
	): void {
		for (const child of Object.values(section.children)) {
			if (child.type === TreeNodeType.Section) {
				this.propagateStatus(child, status);
			} else {
				(child as ScrollNode).status = status;
			}
		}
	}

	// ─── Traversal Helpers ───

	/** Find section by chain. Part of TreeAccessor interface. */
	findSection(chain: SectionNodeSegmentId[]): SectionNode | undefined {
		// First element is Library root → current = this.root; rest → traverse children
		let current: SectionNode | null = null;
		for (const segId of chain) {
			if (!current) {
				current = this.root;
				continue;
			}
			const child = current.children[segId];
			if (!child || child.type !== TreeNodeType.Section) return undefined;
			current = child;
		}
		return current ?? this.root;
	}

	private ensureSectionChain(chain: SectionNodeSegmentId[]): SectionNode {
		// First element is Library root → current = this.root; rest → traverse/create children
		let current: SectionNode | null = null;
		for (const segId of chain) {
			if (!current) {
				current = this.root;
				continue;
			}
			let child = current.children[segId];
			if (!child) {
				const nodeName = this.extractNodeNameFromSegmentId(segId);
				child = {
					children: {},
					nodeName,
					type: TreeNodeType.Section,
				};
				current.children[segId] = child;
			}
			if (child.type !== TreeNodeType.Section) {
				throw new Error(
					`Expected section at ${segId}, got ${child.type}`,
				);
			}
			current = child;
		}
		return current ?? this.root;
	}

	private extractNodeNameFromSegmentId(
		segId: SectionNodeSegmentId,
	): NodeName {
		const sep = NodeSegmentIdSeparator;
		const [raw] = segId.split(sep, 1);
		return raw as NodeName;
	}

	// ─── Healing Computation ───

	private computeLeafHealing(
		locator: ScrollNodeLocator | FileNodeLocator,
		observedSplitPath:
			| SplitPathToMdFileInsideLibrary
			| SplitPathToFileInsideLibrary,
	): HealingAction[] {
		const canonicalSplitPath = this.buildCanonicalLeafSplitPath(locator);
		const healingActions: HealingAction[] = [];

		if (!this.splitPathsEqual(observedSplitPath, canonicalSplitPath)) {
			if (observedSplitPath.type === SplitPathType.MdFile) {
				healingActions.push({
					payload: {
						from: observedSplitPath,
						to: canonicalSplitPath as SplitPathToMdFileInsideLibrary,
					},
					type: "RenameMdFile",
				});
			} else {
				healingActions.push({
					payload: {
						from: observedSplitPath as SplitPathToFileInsideLibrary,
						to: canonicalSplitPath as SplitPathToFileInsideLibrary,
					},
					type: "RenameFile",
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
			if (child.type === TreeNodeType.Section) {
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
					targetType: child.type,
				} as ScrollNodeLocator | FileNodeLocator;

				// Build observed split path for this leaf
				// - basename uses OLD suffix (what the file WAS named)
				// - pathParts uses CURRENT path (where the file IS now)
				const observedSplitPath = this.buildObservedLeafSplitPath(
					child,
					oldSuffixPathParts,
					actualCurrentPath,
				);

				logger.info("[LibraryTree] Leaf healing:", {
					actualCurrentPath,
					observedSplitPath,
					oldSuffixPathParts,
					sectionChain,
					segId,
				});

				const leafHealing = this.computeLeafHealing(
					locator,
					observedSplitPath,
				);
				logger.info("[LibraryTree] Leaf healing result:", leafHealing);
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
			makeSuffixPartsFromPathPartsWithRoot(oldSuffixPathParts);

		const basename = makeJoinedSuffixedBasename({
			coreName: leaf.nodeName,
			suffixParts,
		});

		// pathParts = CURRENT path (where file IS now)
		if (leaf.type === TreeNodeType.Scroll) {
			return {
				basename,
				extension: "md",
				pathParts: currentPathParts,
				type: SplitPathType.MdFile,
			};
		}

		return {
			basename,
			extension: leaf.extension,
			pathParts: currentPathParts,
			type: SplitPathType.File,
		};
	}

	private buildCanonicalLeafSplitPath(
		locator: ScrollNodeLocator | FileNodeLocator,
	): SplitPathToMdFileInsideLibrary | SplitPathToFileInsideLibrary {
		// Chain already includes Library root
		const pathParts = locator.segmentIdChainToParent.map((segId) =>
			this.extractNodeNameFromSegmentId(segId),
		);

		const suffixParts = makeSuffixPartsFromPathPartsWithRoot(pathParts);

		// Get node name from locator
		const nodeName = this.extractNodeNameFromLeafSegmentId(
			locator.segmentId,
		);

		const basename = makeJoinedSuffixedBasename({
			coreName: nodeName,
			suffixParts,
		});

		if (locator.targetType === TreeNodeType.Scroll) {
			return {
				basename,
				extension: "md",
				pathParts,
				type: SplitPathType.MdFile,
			};
		}

		// Extract extension from segmentId
		const extension = this.extractExtensionFromSegmentId(locator.segmentId);
		return {
			basename,
			extension,
			pathParts,
			type: SplitPathType.File,
		};
	}

	private buildCanonicalLeafSplitPathFromOldLocator(
		locator: ScrollNodeLocator | FileNodeLocator,
	): SplitPathToMdFileInsideLibrary | SplitPathToFileInsideLibrary {
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

	private extractNodeNameFromLeafSegmentId(
		segId: TreeNodeSegmentId,
	): NodeName {
		const sep = NodeSegmentIdSeparator;
		const [raw] = segId.split(sep, 1);
		return raw as NodeName;
	}

	private extractExtensionFromSegmentId(segId: TreeNodeSegmentId): string {
		const sep = NodeSegmentIdSeparator;
		const parts = segId.split(sep);
		return parts[parts.length - 1] ?? "";
	}

	private splitPathsEqual(
		a: SplitPathInsideLibrary,
		b: SplitPathInsideLibrary,
	): boolean {
		if (a.type !== b.type) return false;
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

	// ─── Test Helpers ───

	getRoot(): SectionNode {
		return this.root;
	}
}
