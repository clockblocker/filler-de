import { getParsedUserSettings } from "../../../global-state/global-state";
import { SplitPathType } from "../../../obsidian-vault-action-manager/types/split-path";
import type { NodeName } from "../types/schemas/node-name";
import { TreeNodeStatus, TreeNodeType } from "./tree-node/types/atoms";
import {
	type SectionNodeSegmentId,
	NodeSegmentIdSeparator,
	type TreeNodeSegmentId,
	type ScrollNodeSegmentId,
	type FileNodeSegmentId,
} from "./tree-node/types/node-segment-id";
import type {
	FileNode,
	LeafNode,
	ScrollNode,
	SectionNode,
	TreeNode,
} from "./tree-node/types/tree-node";
import { makeNodeSegmentId } from "./tree-node/codecs/node-and-segment-id/make-node-segment-id";
import type {
	TreeAction,
	CreateTreeLeafAction,
	DeleteNodeAction,
	RenameNodeAction,
	MoveNodeAction,
	ChangeNodeStatusAction,
} from "./tree-action/types/tree-action";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
} from "./tree-action/types/target-chains";
import { makeJoinedSuffixedBasename } from "./tree-action/utils/canonical-naming/suffix-utils/core-suffix-utils";
import { getNodeName } from "./tree-action/utils/locator/locator-utils";
import type {
	SplitPathInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "./tree-action/bulk-vault-action-adapter/layers/library-scope/types/inside-library-split-paths";
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

export type ApplyResult = {
	healingActions: HealingAction[];
};

// ─── LibraryTree ───

export class LibraryTree {
	private root: SectionNode;

	constructor(libraryRootName: NodeName) {
		this.root = {
			nodeName: libraryRootName,
			type: TreeNodeType.Section,
			children: {},
		};
	}

	/** Main entry: apply action, return healing actions (library-scoped) */
	apply(action: TreeAction): ApplyResult {
		const actionType = action.actionType;
		if (actionType === "Create") {
			return this.applyCreate(action as CreateTreeLeafAction);
		}
		if (actionType === "Delete") {
			return this.applyDelete(action as DeleteNodeAction);
		}
		if (actionType === "Rename") {
			return this.applyRename(action as RenameNodeAction);
		}
		if (actionType === "Move") {
			return this.applyMove(action as MoveNodeAction);
		}
		// ChangeStatus
		return this.applyChangeStatus(action as ChangeNodeStatusAction);
	}

	// ─── Create ───

	private applyCreate(action: CreateTreeLeafAction): ApplyResult {
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
				nodeName,
				type: TreeNodeType.Scroll,
				status: action.initialStatus ?? TreeNodeStatus.NotStarted,
				extension: "md",
			};
		}
		// File
		return {
			nodeName,
			type: TreeNodeType.File,
			status: TreeNodeStatus.Unknown,
			extension: action.observedSplitPath.extension,
		};
	}

	// ─── Delete ───

	private applyDelete(action: DeleteNodeAction): ApplyResult {
		const { targetLocator } = action;
		const parentSection = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!parentSection) return { healingActions: [] };

		delete parentSection.children[targetLocator.segmentId];

		// Auto-prune empty ancestors
		this.pruneEmptyAncestors(targetLocator.segmentIdChainToParent);

		return { healingActions: [] };
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

	private applyRename(action: RenameNodeAction): ApplyResult {
		const { targetLocator, newNodeName } = action;
		const parentSection = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!parentSection) return { healingActions: [] };

		const node = parentSection.children[targetLocator.segmentId];
		if (!node) return { healingActions: [] };

		// Remove old, insert with new name
		delete parentSection.children[targetLocator.segmentId];
		node.nodeName = newNodeName;
		const newSegmentId = makeSegmentId(node);
		parentSection.children[newSegmentId] = node;

		// If section renamed, update descendant suffixes
		if (node.type === TreeNodeType.Section) {
			// Compute old section path for deriving descendant observed paths
			const oldSectionPath = this.buildSectionPath(
				targetLocator.segmentIdChainToParent,
				this.extractNodeNameFromSegmentId(targetLocator.segmentId as SectionNodeSegmentId),
			);
			return this.computeDescendantSuffixHealing(
				[...targetLocator.segmentIdChainToParent, newSegmentId as SectionNodeSegmentId],
				node,
				oldSectionPath,
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

	private applyMove(action: MoveNodeAction): ApplyResult {
		const { targetLocator, newParentLocator, newNodeName, observedSplitPath } =
			action;

		// Detach from old parent
		const oldParent = this.findSection(targetLocator.segmentIdChainToParent);
		if (!oldParent) return { healingActions: [] };

		const node = oldParent.children[targetLocator.segmentId];
		if (!node) return { healingActions: [] };

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
		if (node.type === TreeNodeType.Section) {
			// For section move, observedSplitPath is the section's new observed location
			return this.computeDescendantSuffixHealing(
				[...newParentChain, newSegmentId as SectionNodeSegmentId],
				node,
				observedSplitPath.pathParts,
			);
		}

		// Leaf move - narrow the types
		if (node.type === TreeNodeType.Scroll) {
			const newLocator: ScrollNodeLocator = {
				segmentIdChainToParent: newParentChain,
				segmentId: newSegmentId as ScrollNodeSegmentId,
				targetType: TreeNodeType.Scroll,
			};
			return this.computeLeafHealing(
				newLocator,
				observedSplitPath as SplitPathToMdFileInsideLibrary,
			);
		}

		// File
		const newLocator: FileNodeLocator = {
			segmentIdChainToParent: newParentChain,
			segmentId: newSegmentId as FileNodeSegmentId,
			targetType: TreeNodeType.File,
		};
		return this.computeLeafHealing(
			newLocator,
			observedSplitPath as SplitPathToFileInsideLibrary,
		);
	}

	// ─── ChangeStatus ───

	private applyChangeStatus(action: ChangeNodeStatusAction): ApplyResult {
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
			const parent = this.findSection(targetLocator.segmentIdChainToParent);
			if (parent) {
				const node = parent.children[targetLocator.segmentId];
				if (node && node.type !== TreeNodeType.Section) {
					(node as ScrollNode).status = newStatus;
				}
			}
		}

		return { healingActions: [] };
	}

	private propagateStatus(section: SectionNode, status: TreeNodeStatus): void {
		for (const child of Object.values(section.children)) {
			if (child.type === TreeNodeType.Section) {
				this.propagateStatus(child, status);
			} else {
				(child as ScrollNode).status = status;
			}
		}
	}

	// ─── Traversal Helpers ───

	private findSection(chain: SectionNodeSegmentId[]): SectionNode | undefined {
		let current: SectionNode = this.root;
		for (const segId of chain) {
			const child = current.children[segId];
			if (!child || child.type !== TreeNodeType.Section) return undefined;
			current = child;
		}
		return current;
	}

	private ensureSectionChain(chain: SectionNodeSegmentId[]): SectionNode {
		let current: SectionNode = this.root;
		for (const segId of chain) {
			let child = current.children[segId];
			if (!child) {
				const nodeName = this.extractNodeNameFromSegmentId(segId);
				child = {
					nodeName,
					type: TreeNodeType.Section,
					children: {},
				};
				current.children[segId] = child;
			}
			if (child.type !== TreeNodeType.Section) {
				throw new Error(`Expected section at ${segId}, got ${child.type}`);
			}
			current = child;
		}
		return current;
	}

	private extractNodeNameFromSegmentId(segId: SectionNodeSegmentId): NodeName {
		const sep = NodeSegmentIdSeparator;
		const [raw] = segId.split(sep, 1);
		return raw as NodeName;
	}

	// ─── Healing Computation ───

	private computeLeafHealing(
		locator: ScrollNodeLocator | FileNodeLocator,
		observedSplitPath: SplitPathToMdFileInsideLibrary | SplitPathToFileInsideLibrary,
	): ApplyResult {
		const canonicalSplitPath = this.buildCanonicalLeafSplitPath(locator);
		const healingActions: HealingAction[] = [];

		if (!this.splitPathsEqual(observedSplitPath, canonicalSplitPath)) {
			if (observedSplitPath.type === SplitPathType.MdFile) {
				healingActions.push({
					type: "RenameMdFile",
					payload: {
						from: observedSplitPath,
						to: canonicalSplitPath as SplitPathToMdFileInsideLibrary,
					},
				});
			} else {
				healingActions.push({
					type: "RenameFile",
					payload: {
						from: observedSplitPath as SplitPathToFileInsideLibrary,
						to: canonicalSplitPath as SplitPathToFileInsideLibrary,
					},
				});
			}
		}

		return { healingActions };
	}

	private computeDescendantSuffixHealing(
		sectionChain: SectionNodeSegmentId[],
		section: SectionNode,
		observedParentPathParts: string[],
	): ApplyResult {
		const healingActions: HealingAction[] = [];

		for (const [segId, child] of Object.entries(section.children)) {
			if (child.type === TreeNodeType.Section) {
				// Recurse with extended observed path
				const childObservedPath = [...observedParentPathParts, child.nodeName];
				const childHealing = this.computeDescendantSuffixHealing(
					[...sectionChain, segId as SectionNodeSegmentId],
					child,
					childObservedPath,
				);
				healingActions.push(...childHealing.healingActions);
			} else {
				// Leaf: derive observed path from parent + leaf basename
				const locator: ScrollNodeLocator | FileNodeLocator = {
					segmentIdChainToParent: sectionChain,
					segmentId: segId as TreeNodeSegmentId,
					targetType: child.type,
				} as ScrollNodeLocator | FileNodeLocator;

				// Build observed split path for this leaf
				// The basename in observed path uses OLD suffix (before section rename)
				// We need to compute what the file WAS named
				const observedSplitPath = this.buildObservedLeafSplitPath(
					child,
					observedParentPathParts,
				);

				const leafHealing = this.computeLeafHealing(locator, observedSplitPath);
				healingActions.push(...leafHealing.healingActions);
			}
		}

		return { healingActions };
	}

	private buildObservedLeafSplitPath(
		leaf: ScrollNode | FileNode,
		observedParentPathParts: string[],
	): SplitPathToMdFileInsideLibrary | SplitPathToFileInsideLibrary {
		// Build suffix from observed parent path (excluding Library root)
		// suffixParts is reversed pathParts (excluding first element which is Library root)
		const suffixParts = [...observedParentPathParts].slice(1).reverse();

		const basename = makeJoinedSuffixedBasename({
			coreName: leaf.nodeName,
			suffixParts,
		});

		if (leaf.type === TreeNodeType.Scroll) {
			return {
				type: SplitPathType.MdFile,
				pathParts: observedParentPathParts,
				basename,
				extension: "md",
			};
		}

		return {
			type: SplitPathType.File,
			pathParts: observedParentPathParts,
			basename,
			extension: leaf.extension,
		};
	}

	private buildCanonicalLeafSplitPath(
		locator: ScrollNodeLocator | FileNodeLocator,
	): SplitPathToMdFileInsideLibrary | SplitPathToFileInsideLibrary {
		const { splitPathToLibraryRoot } = getParsedUserSettings();
		const libraryRoot = splitPathToLibraryRoot.basename;

		// Build pathParts from chain (library-scoped, starts with Library)
		const pathParts = [
			libraryRoot,
			...locator.segmentIdChainToParent.map((segId) =>
				this.extractNodeNameFromSegmentId(segId),
			),
		];

		// Build suffix chain (reversed pathParts without library root)
		const suffixParts = [...pathParts].slice(1).reverse();

		// Get node name from locator
		const nodeName = this.extractNodeNameFromLeafSegmentId(locator.segmentId);

		const basename = makeJoinedSuffixedBasename({
			coreName: nodeName,
			suffixParts,
		});

		if (locator.targetType === TreeNodeType.Scroll) {
			return {
				type: SplitPathType.MdFile,
				pathParts,
				basename,
				extension: "md",
			};
		}

		// Extract extension from segmentId
		const extension = this.extractExtensionFromSegmentId(locator.segmentId);
		return {
			type: SplitPathType.File,
			pathParts,
			basename,
			extension,
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
		const { splitPathToLibraryRoot } = getParsedUserSettings();
		const libraryRoot = splitPathToLibraryRoot.basename;

		return [
			libraryRoot,
			...parentChain.map((segId) => this.extractNodeNameFromSegmentId(segId)),
			sectionName,
		];
	}

	private extractNodeNameFromLeafSegmentId(segId: TreeNodeSegmentId): NodeName {
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
		if ("extension" in a && "extension" in b && a.extension !== b.extension) {
			return false;
		}
		return true;
	}

	// ─── Test Helpers ───

	getRoot(): SectionNode {
		return this.root;
	}
}
