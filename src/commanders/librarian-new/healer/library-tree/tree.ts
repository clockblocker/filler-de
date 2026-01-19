import type { Codecs } from "../../codecs";
import type { SegmentIdOf } from "../../codecs/segment-id/types";
import type {
	SectionNodeSegmentId,
	TreeNodeSegmentId,
} from "../../codecs/segment-id/types/segment-id";
import type { NodeName } from "../../types/schemas/node-name";
import type {
	ChangeNodeStatusAction,
	CreateTreeLeafAction,
	DeleteNodeAction,
	MoveNodeAction,
	RenameNodeAction,
	TreeAction,
} from "./tree-action/types/tree-action";
import type { TreeFacade } from "./tree-interfaces";
import { makeNodeSegmentId } from "./tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeKind, TreeNodeStatus } from "./tree-node/types/atoms";
import type {
	FileNode,
	LeafNode,
	ScrollNode,
	SectionNode,
	TreeNode,
} from "./tree-node/types/tree-node";

// ─── Helpers ───

/** Helper to make segment ID with proper type narrowing */
function makeSegmentId(
	node: ScrollNode,
): SegmentIdOf<typeof TreeNodeKind.Scroll>;
function makeSegmentId(node: FileNode): SegmentIdOf<typeof TreeNodeKind.File>;
function makeSegmentId(
	node: SectionNode,
): SegmentIdOf<typeof TreeNodeKind.Section>;
function makeSegmentId(node: TreeNode): TreeNodeSegmentId;
function makeSegmentId(node: TreeNode): TreeNodeSegmentId {
	if (node.kind === TreeNodeKind.Section) {
		return makeNodeSegmentId(node);
	}
	if (node.kind === TreeNodeKind.Scroll) {
		return makeNodeSegmentId(node);
	}
	return makeNodeSegmentId(node);
}

// ─── Tree ───

export class Tree implements TreeFacade {
	private root: SectionNode;
	private codecs: Codecs;

	constructor(libraryRootName: NodeName, codecs: Codecs) {
		this.codecs = codecs;
		this.root = {
			children: {},
			kind: TreeNodeKind.Section,
			nodeName: libraryRootName,
		};
	}

	/** Apply action to tree structure. Returns the mutated node, or null for delete. */
	apply(action: TreeAction): TreeNode | null {
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

	private applyCreate(action: CreateTreeLeafAction): LeafNode {
		const { targetLocator } = action;
		const parentSection = this.ensureSectionChain(
			targetLocator.segmentIdChainToParent,
		);

		const node = this.makeLeafNode(action);
		const segmentId = makeSegmentId(node);
		parentSection.children[segmentId] = node;

		return node;
	}

	private makeLeafNode(action: CreateTreeLeafAction): LeafNode {
		const parseResult = this.codecs.segmentId.parseSegmentId(
			action.targetLocator.segmentId,
		);
		if (parseResult.isErr()) {
			throw new Error(
				`Invalid segment ID in targetLocator: ${parseResult.error.message}`,
			);
		}
		const nodeName = parseResult.value.coreName;

		if (action.targetLocator.targetKind === TreeNodeKind.Scroll) {
			return {
				extension: "md",
				kind: TreeNodeKind.Scroll,
				nodeName,
				status: action.initialStatus ?? TreeNodeStatus.NotStarted,
			};
		}
		// File
		return {
			extension: action.observedSplitPath.extension,
			kind: TreeNodeKind.File,
			nodeName,
			status: TreeNodeStatus.Unknown,
		};
	}

	// ─── Delete ───

	private applyDelete(action: DeleteNodeAction): null {
		const { targetLocator } = action;
		const parentSection = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!parentSection) return null;

		delete parentSection.children[targetLocator.segmentId];

		// Auto-prune empty ancestors
		this.pruneEmptyAncestors(targetLocator.segmentIdChainToParent);
		return null;
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
				child.kind === TreeNodeKind.Section &&
				Object.keys(child.children).length === 0
			) {
				delete parent.children[segmentId];
			} else {
				break; // Stop if non-empty
			}
		}
	}

	// ─── Rename ───

	private applyRename(action: RenameNodeAction): TreeNode | null {
		const { targetLocator, newNodeName } = action;
		const parentSection = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!parentSection) {
			return null;
		}

		const node = parentSection.children[targetLocator.segmentId];
		if (!node) return null;

		// Remove old, insert with new name
		delete parentSection.children[targetLocator.segmentId];
		node.nodeName = newNodeName;
		const newSegmentId = makeSegmentId(node);
		parentSection.children[newSegmentId] = node;

		return node;
	}

	// ─── Move ───

	private applyMove(action: MoveNodeAction): TreeNode | null {
		const { targetLocator, newParentLocator, newNodeName } = action;

		// Detach from old parent
		const oldParent = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!oldParent) return null;

		const node = oldParent.children[targetLocator.segmentId];
		if (!node) return null;

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
		return node;
	}

	// ─── ChangeStatus ───

	private applyChangeStatus(action: ChangeNodeStatusAction): TreeNode | null {
		const { targetLocator, newStatus } = action;

		if (targetLocator.targetKind === TreeNodeKind.Section) {
			// Propagate to descendants
			const section = this.findSection([
				...targetLocator.segmentIdChainToParent,
				targetLocator.segmentId,
			]);
			if (section) {
				this.propagateStatus(section, newStatus);
				return section;
			}
			return null;
		}
		// Direct leaf update
		const parent = this.findSection(targetLocator.segmentIdChainToParent);
		if (parent) {
			const node = parent.children[targetLocator.segmentId];
			if (node && node.kind !== TreeNodeKind.Section) {
				(node as ScrollNode).status = newStatus;
				return node;
			}
		}
		return null;
	}

	private propagateStatus(
		section: SectionNode,
		status: TreeNodeStatus,
	): void {
		for (const child of Object.values(section.children)) {
			if (child.kind === TreeNodeKind.Section) {
				this.propagateStatus(child, status);
			} else {
				(child as ScrollNode).status = status;
			}
		}
	}

	// ─── Traversal Helpers ───

	/** Find section by chain. Part of TreeReader interface. */
	findSection(chain: SectionNodeSegmentId[]): SectionNode | undefined {
		// First element is Library root → current = this.root; rest → traverse children
		let current: SectionNode | null = null;
		for (const segId of chain) {
			if (!current) {
				current = this.root;
				continue;
			}
			const child = current.children[segId];
			if (!child || child.kind !== TreeNodeKind.Section) return undefined;
			current = child;
		}
		return current ?? this.root;
	}

	ensureSectionChain(chain: SectionNodeSegmentId[]): SectionNode {
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
					kind: TreeNodeKind.Section,
					nodeName,
				};
				current.children[segId] = child;
			}
			if (child.kind !== TreeNodeKind.Section) {
				throw new Error(
					`Expected section at ${segId}, got ${child.kind}`,
				);
			}
			current = child;
		}
		return current ?? this.root;
	}

	private extractNodeNameFromSegmentId(
		segId: SectionNodeSegmentId,
	): NodeName {
		const parseResult = this.codecs.segmentId.parseSectionSegmentId(segId);
		if (parseResult.isErr()) {
			throw new Error(
				`Invalid section segment ID during tree construction: ${parseResult.error.message}`,
			);
		}
		return parseResult.value.coreName;
	}

	// ─── Test Helpers ───

	getRoot(): SectionNode {
		return this.root;
	}
}
