import { err, ok, type Result } from "neverthrow";
import {
	type SplitPathToFile,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	SplitPathType,
} from "../../../../../obsidian-vault-action-manager/types/split-path";
import type { NodeName } from "../../../types/schemas/node-name";
import { makeNodeSegmentId } from "../../tree-node/codecs/node-and-segment-id/make-node-segment-id";
import { TreeNodeType } from "../../tree-node/types/atoms";
import type {
	RenameFileNodeMaterializedEvent,
	RenameScrollNodeMaterializedEvent,
	RenameSectionNodeMaterializedEvent,
} from "../bulk-vault-action-adapter/layers/materialized-node-events/types";
import { tryParseCanonicalSplitPath } from "../helpers/canonical-split-path/try-parse-canonical-split-path";
import type {
	CanonicalSplitPathToFile,
	CanonicalSplitPathToFolder,
	CanonicalSplitPathToMdFile,
} from "../helpers/canonical-split-path/types";
import { makeLocatorFromLibraryScopedCanonicalSplitPath } from "../helpers/make-locator";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
	TreeNodeLocator,
} from "../types/target-chains";
import { type MoveNodeAction, TreeActionType } from "../types/tree-action";
import { type ChangePolicy, inferMovePolicy } from "./helpers/policy";

export function traslateMoveMaterializedEvent(
	ev:
		| RenameFileNodeMaterializedEvent
		| RenameScrollNodeMaterializedEvent
		| RenameSectionNodeMaterializedEvent,
): MoveNodeAction[] {
	const out: MoveNodeAction[] = [];

	// 1) infer policy (PathKing vs NameKing) for this rename/move
	const policy = inferMovePolicy(ev);

	// 2) turn observed (from/to) into canonical (nodeName + sectionNames)
	const canonicalRes = tryMakeCanonicalSplitPathFromObservedMove(ev, policy);
	if (canonicalRes.isErr()) return out;

	// 3) build locators:
	//    - target: canonical locator of the node identity BEFORE move (tree uses this)
	//    - newParent + newName: canonical destination derived from `canonicalRes`
	const targetRes = tryMakeTargetLocatorFromObservedMove(ev, policy);
	if (targetRes.isErr()) return out;

	const { target, observedVaultSplitPath } = targetRes.value;

	const newParent = tryMakeSectionLocatorFromSectionNames(
		canonicalRes.value.sectionNames,
	);
	if (newParent.isErr()) return out;

	// leaf/section name at destination
	const newName = canonicalRes.value.nodeName;

	// 4) emit typed MoveNodeAction
	switch (ev.nodeType) {
		case TreeNodeType.File: {
			// TS: ensure file shapes
			out.push({
				actionType: TreeActionType.MoveNode,
				newName,
				newParent: newParent.value,
				observedVaultSplitPath:
					observedVaultSplitPath as SplitPathToFile,
				target: target as FileNodeLocator,
			});
			break;
		}
		case TreeNodeType.Scroll: {
			out.push({
				actionType: TreeActionType.MoveNode,
				newName,
				newParent: newParent.value,
				observedVaultSplitPath:
					observedVaultSplitPath as SplitPathToMdFile,
				target: target as ScrollNodeLocator,
			});
			break;
		}
		case TreeNodeType.Section: {
			out.push({
				actionType: TreeActionType.MoveNode,
				newName,
				newParent: newParent.value,
				observedVaultSplitPath:
					observedVaultSplitPath as SplitPathToFolder,
				target: target as SectionNodeLocator,
			});
			break;
		}
		default: {
			break;
		}
	}

	return out;
}

/**
 * From observed rename/move, produce canonical destination split path
 * (nodeName + sectionNames) according to policy.
 */
declare function tryMakeCanonicalSplitPathFromObservedMove(
	ev:
		| RenameFileNodeMaterializedEvent
		| RenameScrollNodeMaterializedEvent
		| RenameSectionNodeMaterializedEvent,
	policy: ChangePolicy,
): Result<
	| CanonicalSplitPathToFile
	| CanonicalSplitPathToMdFile
	| CanonicalSplitPathToFolder,
	string
>;

/**
 * Decide how to locate the existing node in the Tree (target locator),
 * while also returning the actual observed filesystem location AFTER the user op
 * (used later for healing VaultAction.rename(fromObserved, toCanonical)).
 */
declare function tryMakeTargetLocatorFromObservedMove(
	ev:
		| RenameFileNodeMaterializedEvent
		| RenameScrollNodeMaterializedEvent
		| RenameSectionNodeMaterializedEvent,
	policy: ChangePolicy,
): Result<
	{
		target: TreeNodeLocator;
		observedVaultSplitPath:
			| SplitPathToFile
			| SplitPathToMdFile
			| SplitPathToFolder;
	},
	string
>;

/**
 * Build canonical SectionNodeLocator for the destination parent section chain.
 * If sectionNames=[], parent is Library root section (special-case inside).
 */
/**
 * Build canonical SectionNodeLocator for the destination parent section chain.
 * If sectionNames=[], parent is Library root section.
 */
export function tryMakeSectionLocatorFromSectionNames(
	sectionNames: NodeName[],
): Result<SectionNodeLocator, string> {
	if (sectionNames.length === 0) {
		return ok(makeLibraryRootSectionLocator());
	}

	// last section is the section node; earlier are its parents
	const nodeName = sectionNames[sectionNames.length - 1];
	if (!nodeName) return err("No node name found");
	const parentNames = sectionNames.slice(0, -1);

	const sp: SplitPathToFolder = {
		basename: nodeName, // canonical folder name == nodeName
		pathParts: parentNames, // relative to Library
		type: SplitPathType.Folder,
	};

	const canonicalRes = tryParseCanonicalSplitPath(sp);
	if (canonicalRes.isErr()) return err(canonicalRes.error);

	// canonicalRes.value is CanonicalSplitPathToFolder with nodeName+sectionNames
	return ok(
		makeLocatorFromLibraryScopedCanonicalSplitPath(
			canonicalRes.value,
		) as SectionNodeLocator,
	);
}

/** Canonical locator for the implicit Library root section. */
function makeLibraryRootSectionLocator(): SectionNodeLocator {
	return {
		segmentId: makeNodeSegmentId({
			children: {},
			nodeName: "Library",
			type: TreeNodeType.Section,
		}),
		segmentIdChainToParent: [],
		targetType: TreeNodeType.Section,
	} satisfies SectionNodeLocator;
}
