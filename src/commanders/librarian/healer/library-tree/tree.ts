import { MD } from "../../../../managers/obsidian/vault-action-manager/types/literals";
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

// ─── Result Type ───

/**
 * Result of applying an action to the tree.
 * `changed` indicates if the tree state was actually modified.
 * This enables idempotent healing - if tree already reflects the action, no healing needed.
 */
export type ApplyResult = {
	changed: boolean;
	node: TreeNode | null;
};

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

	/**
	 * Apply action to tree structure.
	 * Returns { changed, node } where:
	 * - changed: true if tree was actually modified, false if already in target state
	 * - node: the affected node (or null for delete)
	 */
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
		const { targetLocator } = action;
		const parentSection = this.ensureSectionChain(
			targetLocator.segmentIdChainToParent,
		);

		// Check if node already exists at this location
		const existingNode = parentSection.children[targetLocator.segmentId];
		if (existingNode) {
			// Node already exists - idempotent no-op
			return { changed: false, node: existingNode };
		}

		const node = this.makeLeafNode(action);
		const segmentId = makeSegmentId(node);
		parentSection.children[segmentId] = node;

		return { changed: true, node };
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
				extension: MD,
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

	private applyDelete(action: DeleteNodeAction): ApplyResult {
		const { targetLocator } = action;
		const parentSection = this.findSection(
			targetLocator.segmentIdChainToParent,
		);

		// If parent doesn't exist, node is already gone - idempotent
		if (!parentSection) {
			return { changed: false, node: null };
		}

		// Check if node exists
		const node = parentSection.children[targetLocator.segmentId];
		if (!node) {
			// Node doesn't exist - idempotent no-op
			return { changed: false, node: null };
		}

		delete parentSection.children[targetLocator.segmentId];

		// Auto-prune empty ancestors
		this.pruneEmptyAncestors(targetLocator.segmentIdChainToParent);
		return { changed: true, node: null };
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

	private applyRename(action: RenameNodeAction): ApplyResult {
		const { targetLocator, newNodeName } = action;
		const parentSection = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!parentSection) {
			return { changed: false, node: null };
		}

		const node = parentSection.children[targetLocator.segmentId];
		if (!node) {
			return { changed: false, node: null };
		}

		// Check if already renamed (idempotent check)
		if (node.nodeName === newNodeName) {
			return { changed: false, node };
		}

		// Remove old, insert with new name
		delete parentSection.children[targetLocator.segmentId];
		node.nodeName = newNodeName;
		const newSegmentId = makeSegmentId(node);
		parentSection.children[newSegmentId] = node;

		return { changed: true, node };
	}

	// ─── Move ───

	private applyMove(action: MoveNodeAction): ApplyResult {
		const { targetLocator, newParentLocator, newNodeName } = action;

		// Detach from old parent
		const oldParent = this.findSection(
			targetLocator.segmentIdChainToParent,
		);
		if (!oldParent) {
			return { changed: false, node: null };
		}

		const node = oldParent.children[targetLocator.segmentId];
		if (!node) {
			return { changed: false, node: null };
		}

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
		return { changed: true, node };
	}

	// ─── ChangeStatus ───

	private applyChangeStatus(action: ChangeNodeStatusAction): ApplyResult {
		const { targetLocator, newStatus } = action;

		if (targetLocator.targetKind === TreeNodeKind.Section) {
			// Propagate to descendants
			const section = this.findSection([
				...targetLocator.segmentIdChainToParent,
				targetLocator.segmentId,
			]);
			if (section) {
				const changed = this.propagateStatus(section, newStatus);
				return { changed, node: section };
			}
			return { changed: false, node: null };
		}
		// Direct leaf update
		const parent = this.findSection(targetLocator.segmentIdChainToParent);
		if (parent) {
			const node = parent.children[targetLocator.segmentId];
			if (node && node.kind !== TreeNodeKind.Section) {
				const scrollNode = node as ScrollNode;
				// Check if already at target status (idempotent)
				if (scrollNode.status === newStatus) {
					return { changed: false, node };
				}
				scrollNode.status = newStatus;
				return { changed: true, node };
			}
		}
		return { changed: false, node: null };
	}

	private propagateStatus(
		section: SectionNode,
		status: TreeNodeStatus,
	): boolean {
		let changed = false;
		for (const child of Object.values(section.children)) {
			if (child.kind === TreeNodeKind.Section) {
				if (this.propagateStatus(child, status)) {
					changed = true;
				}
			} else {
				const scrollNode = child as ScrollNode;
				if (scrollNode.status !== status) {
					scrollNode.status = status;
					changed = true;
				}
			}
		}
		return changed;
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
