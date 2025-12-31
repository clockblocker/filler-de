import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../obsidian-vault-action-manager/types/split-path";
import type { NodeName } from "../../types/schemas/node-name";
import type { TreeNodeType } from "../tree-node/types/atoms";
import {
	MaterializedEventType,
	type MaterializedNodeEvent,
} from "./bulk-vault-action-adapter/layers/materialized-node-events";
import type {
	RenameFileNodeMaterializedEvent,
	RenameScrollNodeMaterializedEvent,
	RenameSectionNodeMaterializedEvent,
} from "./bulk-vault-action-adapter/layers/materialized-node-events/types";
import type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
} from "./types/target-chains";
import {
	type CreateTreeLeafAction,
	type DeleteNodeAction,
	type MoveNodeAction,
	type RenameNodeAction,
	type TreeAction,
	TreeActionType,
} from "./types/tree-action";

export const buildTreeActions = (
	materializedNodeEvents: MaterializedNodeEvent[],
): TreeAction[] => {
	const out: TreeAction[] = [];

	for (const ev of materializedNodeEvents) {
		switch (ev.kind) {
			// ----------------------------
			// Create (leaf only)
			// ----------------------------
			case MaterializedEventType.Create: {
				// helpers (unimplemented)
				const target = makeLeafLocatorFromLibraryScopedSplitPath(
					ev.libraryScopedSplitPath,
					ev.nodeType, // File | Scroll
				);

				out.push({
					actionType: TreeActionType.CreateNode,
					target,
					// initialStatus: optional, later
				} as CreateTreeLeafAction);

				break;
			}

			// ----------------------------
			// Delete (file/scroll/section)
			// ----------------------------
			case MaterializedEventType.Delete: {
				// helpers (unimplemented)
				const target = makeLocatorFromLibraryScopedSplitPath(
					ev.libraryScopedSplitPath,
					ev.nodeType, // File | Scroll | Section
				);

				out.push({
					actionType: TreeActionType.DeleteNode,
					target,
				} as DeleteNodeAction);

				break;
			}

			// ----------------------------
			// Rename roots (inside→inside only)
			// ----------------------------
			case MaterializedEventType.Rename: {
				// helpers (unimplemented)
				const hasDelimiter = hasSuffixDelimiterInRenameTo(ev);

				const target = makeLocatorFromRenameFrom(ev); // locate existing node (from-based, for now)
				const newName = extractNodeNameFromRenameTo(ev);

				if (!hasDelimiter) {
					out.push({
						actionType: TreeActionType.RenameNode,
						newName,
						target,
					} as RenameNodeAction);
					break;
				}

				const newParent = deriveNewParentFromRenameTo(ev); // from suffix-chain tokens
				const observedVaultSplitPath =
					getObservedSplitPathFromRenameTo(ev); // typed to match nodeType

				out.push({
					actionType: TreeActionType.MoveNode,
					newName,
					newParent,
					observedVaultSplitPath,
					target,
				} as MoveNodeAction);

				break;
			}

			default: {
				const _never: never = ev;
				return _never;
			}
		}
	}

	return out;
};

// ------------------------------------
// helpers (TODO implement)
// ------------------------------------

declare function makeLeafLocatorFromLibraryScopedSplitPath(
	splitPath: SplitPathToFile | SplitPathToMdFile,
	nodeType: typeof TreeNodeType.File | typeof TreeNodeType.Scroll,
): FileNodeLocator | ScrollNodeLocator;

declare function makeLocatorFromLibraryScopedSplitPath(
	splitPath: SplitPathToFile | SplitPathToMdFile | SplitPathToFolder,
	nodeType:
		| typeof TreeNodeType.File
		| typeof TreeNodeType.Scroll
		| typeof TreeNodeType.Section,
): FileNodeLocator | ScrollNodeLocator | SectionNodeLocator;

declare function hasSuffixDelimiterInRenameTo(
	ev:
		| RenameFileNodeMaterializedEvent
		| RenameScrollNodeMaterializedEvent
		| RenameSectionNodeMaterializedEvent,
): boolean;

declare function makeLocatorFromRenameFrom(
	ev:
		| RenameFileNodeMaterializedEvent
		| RenameScrollNodeMaterializedEvent
		| RenameSectionNodeMaterializedEvent,
): FileNodeLocator | ScrollNodeLocator | SectionNodeLocator;

declare function extractNodeNameFromRenameTo(
	ev:
		| RenameFileNodeMaterializedEvent
		| RenameScrollNodeMaterializedEvent
		| RenameSectionNodeMaterializedEvent,
): NodeName;

declare function deriveNewParentFromRenameTo(
	ev:
		| RenameFileNodeMaterializedEvent
		| RenameScrollNodeMaterializedEvent
		| RenameSectionNodeMaterializedEvent,
): SectionNodeLocator;

declare function getObservedSplitPathFromRenameTo(
	ev: RenameFileNodeMaterializedEvent,
): SplitPathToFile;
declare function getObservedSplitPathFromRenameTo(
	ev: RenameScrollNodeMaterializedEvent,
): SplitPathToMdFile;
declare function getObservedSplitPathFromRenameTo(
	ev: RenameSectionNodeMaterializedEvent,
): SplitPathToFolder;
