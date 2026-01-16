import { ok } from "neverthrow";
import { logger } from "../../../utils/logger";
import { SplitPathKind } from "../../../managers/obsidian/vault-action-manager/types/split-path";
import type {
	Codecs,
	SplitPathToFileInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "../codecs";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
} from "../codecs/locator/types";
import type {
	SectionNodeSegmentId,
	TreeNodeSegmentId,
} from "../codecs/segment-id/types/segment-id";
import { DirtyTracker } from "./dirty-tracker";
import type { TreeAccessor } from "./library-tree/codex/codex-impact-to-actions";
import {
	type CodexImpact,
	computeCodexImpact,
} from "./library-tree/codex/compute-codex-impact";
import { mergeCodexImpacts } from "./library-tree/codex/merge-codex-impacts";
import type { Tree } from "./library-tree/tree";
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
	SectionNode,
	TreeNode,
} from "./library-tree/tree-node/types/tree-node";
import type { HealingAction } from "./library-tree/types/healing-action";
import { sectionChainToPathParts } from "./library-tree/utils/section-chain-utils";
import {
	buildCanonicalLeafSplitPath,
	buildObservedLeafSplitPath,
	splitPathsEqual,
} from "./library-tree/utils/split-path-utils";

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
	private dirtyTracker = new DirtyTracker();
	private deferredCodexImpacts: CodexImpact[] = [];

	constructor(tree: Tree, codecs: Codecs) {
		this.tree = tree;
		this.codecs = codecs;
	}

	/** Main entry: apply action, return healing actions + codex impact */
	getHealingActionsFor(action: TreeAction): ApplyResult {
		// Compute codex impact BEFORE applying (uses action locators)
		const codexImpact = computeCodexImpact(action);

		// Apply action to tree (modifies tree structure), capture mutated node
		const mutatedNode = this.tree.apply(action);

		// Compute healing actions based on action type
		const healingActions = this.computeHealingForAction(action, mutatedNode);

		return { codexImpact, healingActions };
	}

	// ─── Deferred Healing (Pull-based) ───

	/**
	 * Apply action to tree and mark dirty for later healing computation.
	 * Use flushHealing() to compute all healing in a single pass.
	 */
	applyDeferred(action: TreeAction): TreeNode | null {
		// Compute codex impact BEFORE applying (uses action locators)
		const impact = computeCodexImpact(action);

		// Apply action to tree
		const node = this.tree.apply(action);

		// Store impact for batch processing
		this.deferredCodexImpacts.push(impact);

		// Mark dirty chains from impact
		this.dirtyTracker.markAllDirty(impact.impactedChains, "content");

		return node;
	}

	/**
	 * Flush all dirty nodes and compute healing in a single pass.
	 * Returns combined ApplyResult for all deferred actions.
	 */
	flushHealing(): ApplyResult {
		// Merge all deferred codex impacts
		const mergedImpact = mergeCodexImpacts(this.deferredCodexImpacts);
		this.deferredCodexImpacts = [];

		// Get and clear dirty nodes
		const dirtyNodes = this.dirtyTracker.flush();

		// Compute healing for all dirty chains (currently no-op, healing is codex-based)
		const healingActions: HealingAction[] = [];

		return { codexImpact: mergedImpact, healingActions };
	}

	/**
	 * Check if there are deferred actions waiting to be flushed.
	 */
	hasDeferredActions(): boolean {
		return this.deferredCodexImpacts.length > 0 || !this.dirtyTracker.isEmpty();
	}

	// ─── TreeAccessor Implementation ───

	findSection(chain: SectionNodeSegmentId[]): SectionNode | undefined {
		return this.tree.findSection(chain);
	}

	getRoot(): SectionNode {
		return this.tree.getRoot();
	}

	// ─── Healing Computation ───

	private computeHealingForAction(
		action: TreeAction,
		mutatedNode: TreeNode | null,
	): HealingAction[] {
		const actionType = action.actionType;

		if (actionType === "Create") {
			return this.computeCreateHealing(action as CreateTreeLeafAction);
		}
		if (actionType === "Delete") {
			return this.computeDeleteHealing(action as DeleteNodeAction);
		}
		if (actionType === "Rename") {
			return this.computeRenameHealing(
				action as RenameNodeAction,
				mutatedNode,
			);
		}
		if (actionType === "Move") {
			return this.computeMoveHealing(action as MoveNodeAction, mutatedNode);
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
		// Narrow types based on locator kind
		if (targetLocator.targetKind === TreeNodeKind.Scroll) {
			if (observedSplitPath.kind === SplitPathKind.MdFile) {
				return this.computeLeafHealing(
					targetLocator,
					observedSplitPath,
				);
			}
		} else {
			if (observedSplitPath.kind === SplitPathKind.File) {
				return this.computeLeafHealing(
					targetLocator,
					observedSplitPath,
				);
			}
		}
		return [];
	}

	private computeDeleteHealing(_action: DeleteNodeAction): HealingAction[] {
		// Delete doesn't generate healing actions
		return [];
	}

	private computeRenameHealing(
		action: RenameNodeAction,
		mutatedNode: TreeNode | null,
	): HealingAction[] {
		const { targetLocator, newNodeName } = action;

		// Use mutated node directly (returned from tree.apply)
		if (!mutatedNode) return [];
		const node = mutatedNode;

		// Compute new segment ID
		// biome-ignore lint/suspicious/noExplicitAny: Type assertion needed: makeNodeSegmentId overloads require specific node types, but TypeScript can't narrow union for overload resolution
		const newSegmentId = makeNodeSegmentId(node as any);

		// If section renamed, update descendant suffixes
		if (node.kind === TreeNodeKind.Section) {
			// Old path: parent chain + OLD section name (from targetLocator.segmentId)
			const oldSectionPathResult = sectionChainToPathParts(
				targetLocator.segmentIdChainToParent,
				this.codecs.segmentId,
			);
			if (oldSectionPathResult.isErr()) {
				throw new Error(
					`Failed to parse section chain: ${oldSectionPathResult.error.message}`,
				);
			}
			const oldNodeNameResult =
				this.codecs.segmentId.parseSectionSegmentId(
					targetLocator.segmentId as SectionNodeSegmentId,
				);
			if (oldNodeNameResult.isErr()) {
				throw new Error(
					`Failed to parse segment ID: ${oldNodeNameResult.error.message}`,
				);
			}
			const oldSectionPath = [
				...oldSectionPathResult.value,
				oldNodeNameResult.value.coreName,
			];
			// New chain in tree (where section IS now)
			const newSectionChain = [
				...targetLocator.segmentIdChainToParent,
				newSegmentId as SectionNodeSegmentId,
			];
			// Current path in filesystem: parent chain + NEW section name
			const currentSectionPath = [
				...oldSectionPathResult.value,
				newNodeName,
			];
			return this.computeDescendantSuffixHealing(
				newSectionChain,
				node,
				oldSectionPath,
				currentSectionPath,
			);
		}

		// Leaf rename needs observed path - but rename action doesn't carry it
		// The observed path IS the canonical path before rename (tree was in sync)
		const oldCanonicalResult = buildCanonicalLeafSplitPath(
			targetLocator as ScrollNodeLocator | FileNodeLocator,
			this.codecs,
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

		// Narrow types based on locator kind
		if (newLocator.targetKind === TreeNodeKind.Scroll) {
			if (oldCanonical.kind === SplitPathKind.MdFile) {
				return this.computeLeafHealing(newLocator, oldCanonical);
			}
		} else {
			if (oldCanonical.kind === SplitPathKind.File) {
				return this.computeLeafHealing(newLocator, oldCanonical);
			}
		}
		return [];
	}

	private computeMoveHealing(
		action: MoveNodeAction,
		mutatedNode: TreeNode | null,
	): HealingAction[] {
		const {
			targetLocator,
			newParentLocator,
			newNodeName,
			observedSplitPath,
		} = action;

		// Use mutated node directly (returned from tree.apply)
		if (!mutatedNode) return [];
		const node = mutatedNode;

		// Compute new parent chain
		const newParentChain = [
			...newParentLocator.segmentIdChainToParent,
			newParentLocator.segmentId,
		];

		// Compute old section path (before move) - use old node name from targetLocator
		const oldSectionPathResult =
			node.kind === TreeNodeKind.Section
				? (() => {
						const parentPathResult = sectionChainToPathParts(
							targetLocator.segmentIdChainToParent,
							this.codecs.segmentId,
						);
						if (parentPathResult.isErr()) {
							return parentPathResult;
						}
						const oldNodeNameResult =
							this.codecs.segmentId.parseSectionSegmentId(
								targetLocator.segmentId as SectionNodeSegmentId,
							);
						if (oldNodeNameResult.isErr()) {
							return oldNodeNameResult;
						}
						return ok([
							...parentPathResult.value,
							oldNodeNameResult.value.coreName,
						]);
					})()
				: null;
		if (oldSectionPathResult?.isErr()) {
			throw new Error(
				`Failed to parse section path: ${oldSectionPathResult.error.message}`,
			);
		}
		const oldSectionPath = oldSectionPathResult?.isOk()
			? oldSectionPathResult.value
			: null;

		// Compute healing
		if (node.kind === TreeNodeKind.Section && oldSectionPath) {
			// New chain in tree
			const newSegmentId = makeNodeSegmentId(node);
			const newSectionChain = [
				...newParentChain,
				newSegmentId as SectionNodeSegmentId,
			];
			// Canonical path: parent chain + new node name
			const canonicalSectionPathResult = sectionChainToPathParts(
				newParentChain,
				this.codecs.segmentId,
			);
			if (canonicalSectionPathResult.isErr()) {
				throw new Error(
					`Failed to parse section chain: ${canonicalSectionPathResult.error.message}`,
				);
			}
			const canonicalSectionPath = [
				...canonicalSectionPathResult.value,
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
				const renameFolderAction = {
					kind: "RenameFolder" as const,
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
				};
				healingActions.push(renameFolderAction);
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
		// biome-ignore lint/suspicious/noExplicitAny: Type assertion needed: makeNodeSegmentId overloads require specific node types, but TypeScript can't narrow union for overload resolution
		const newSegmentId = makeNodeSegmentId(node as any);
		if (node.kind === TreeNodeKind.Scroll) {
			const newLocator: ScrollNodeLocator = {
				segmentId: newSegmentId as ScrollNodeLocator["segmentId"],
				segmentIdChainToParent: newParentChain,
				targetKind: TreeNodeKind.Scroll,
			};
			// Type guard: observedSplitPath must be MdFile for Scroll
			if (observedSplitPath.kind === SplitPathKind.MdFile) {
				return this.computeLeafHealing(newLocator, observedSplitPath);
			}
		}

		// File
		const newLocator: FileNodeLocator = {
			segmentId: newSegmentId as FileNodeLocator["segmentId"],
			segmentIdChainToParent: newParentChain,
			targetKind: TreeNodeKind.File,
		};
		// Type guard: observedSplitPath must be File for File
		if (observedSplitPath.kind === SplitPathKind.File) {
			return this.computeLeafHealing(newLocator, observedSplitPath);
		}

		// Fallback (should not happen if types are correct)
		return [];
	}

	private computeChangeStatusHealing(
		_action: ChangeNodeStatusAction,
	): HealingAction[] {
		// ChangeStatus doesn't generate healing actions
		return [];
	}

	private computeLeafHealing(
		locator: ScrollNodeLocator,
		observedSplitPath: SplitPathToMdFileInsideLibrary,
	): HealingAction[];
	private computeLeafHealing(
		locator: FileNodeLocator,
		observedSplitPath: SplitPathToFileInsideLibrary,
	): HealingAction[];
	private computeLeafHealing(
		locator: ScrollNodeLocator | FileNodeLocator,
		observedSplitPath:
			| SplitPathToMdFileInsideLibrary
			| SplitPathToFileInsideLibrary,
	): HealingAction[] {
		const canonicalSplitPathResult = buildCanonicalLeafSplitPath(
			locator,
			this.codecs,
		);
		if (canonicalSplitPathResult.isErr()) {
			// Error indicates bug in tree structure - propagate by throwing
			throw new Error(
				`Failed to build canonical split path: ${canonicalSplitPathResult.error.message}`,
			);
		}
		const canonicalSplitPath = canonicalSplitPathResult.value;
		const healingActions: HealingAction[] = [];

		if (!splitPathsEqual(observedSplitPath, canonicalSplitPath)) {
			if (observedSplitPath.kind === SplitPathKind.MdFile) {
				// Narrow canonicalSplitPath based on observedSplitPath.kind
				if (canonicalSplitPath.kind === SplitPathKind.MdFile) {
					healingActions.push({
						kind: "RenameMdFile",
						payload: {
							from: observedSplitPath,
							to: canonicalSplitPath,
						},
					});
				}
			} else {
				// Narrow canonicalSplitPath based on observedSplitPath.kind
				if (canonicalSplitPath.kind === SplitPathKind.File) {
					healingActions.push({
						kind: "RenameFile",
						payload: {
							from: observedSplitPath,
							to: canonicalSplitPath,
						},
					});
				}
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
			(() => {
				const pathResult = sectionChainToPathParts(
					sectionChain,
					this.codecs.segmentId,
				);
				if (pathResult.isErr()) {
					throw new Error(
						`Failed to parse section chain: ${pathResult.error.message}`,
					);
				}
				return pathResult.value;
			})();

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
				const locator = {
					segmentId: segId as TreeNodeSegmentId,
					segmentIdChainToParent: sectionChain,
					targetKind: child.kind,
				};

				// Build observed split path for this leaf
				// - basename uses OLD suffix (what the file WAS named)
				// - pathParts uses CURRENT path (where the file IS now)
				const observedSplitPath = buildObservedLeafSplitPath(
					child,
					oldSuffixPathParts,
					actualCurrentPath,
					this.codecs,
				);

				// Narrow types based on child kind
				if (child.kind === TreeNodeKind.Scroll) {
					if (observedSplitPath.kind === SplitPathKind.MdFile) {
						const leafHealing = this.computeLeafHealing(
							locator,
							observedSplitPath,
						);
						healingActions.push(...leafHealing);
					}
				} else {
					if (observedSplitPath.kind === SplitPathKind.File) {
						const leafHealing = this.computeLeafHealing(
							locator,
							observedSplitPath,
						);
						healingActions.push(...leafHealing);
					}
				}
			}
		}

		return healingActions;
	}
}
