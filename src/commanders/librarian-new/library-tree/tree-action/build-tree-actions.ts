import type { BulkVaultEvent } from "../../../../obsidian-vault-action-manager";
import type {
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "../../../../obsidian-vault-action-manager/types/split-path";
import type { NodeName } from "../../types/schemas/node-name";
import { TreeNodeType } from "../tree-node/types/atoms";
import { traslateCreateMaterializedEvent } from "./action-builders/translate-create-actions";
import { makeLibraryScopedBulkVaultEvent } from "./bulk-vault-action-adapter/layers/library-scope";
import {
	MaterializedEventType,
	materializeScopedBulk,
} from "./bulk-vault-action-adapter/layers/materialized-node-events";
import type {
	RenameFileNodeMaterializedEvent,
	RenameScrollNodeMaterializedEvent,
	RenameSectionNodeMaterializedEvent,
} from "./bulk-vault-action-adapter/layers/materialized-node-events/types";
import { tryParseCanonicalSplitPath } from "./helpers/canonical-split-path/try-parse-canonical-split-path";
import { makeLocatorFromLibraryScopedCanonicalSplitPath } from "./helpers/make-locator";
import type { SectionNodeLocator } from "./types/target-chains";
import { type TreeAction, TreeActionType } from "./types/tree-action";

export const buildTreeActions = (bulk: BulkVaultEvent): TreeAction[] => {
	const out: TreeAction[] = [];

	const materializedNodeEvents = materializeScopedBulk(
		makeLibraryScopedBulkVaultEvent(bulk),
	);

	for (const ev of materializedNodeEvents) {
		switch (ev.kind) {
			// ----------------------------
			// Create (leaf only)
			// ----------------------------
			case MaterializedEventType.Create: {
				out.push(...traslateCreateMaterializedEvent(ev));
				break;
			}

			// ...

			// ----------------------------
			// Delete (file/scroll/section)
			// ----------------------------
			case MaterializedEventType.Delete: {
				// uses existing: tryParseCanonicalSplitPath + makeLocatorFromLibraryScopedCanonicalSplitPath
				const cspRes = tryParseCanonicalSplitPath(
					ev.libraryScopedSplitPath,
				);
				if (cspRes.isErr()) break;

				const target = makeLocatorFromLibraryScopedCanonicalSplitPath(
					cspRes.value,
				);

				switch (target.targetType) {
					case TreeNodeType.File: {
						out.push({
							actionType: TreeActionType.DeleteNode,
							target,
						});
						break;
					}
					case TreeNodeType.Scroll: {
						out.push({
							actionType: TreeActionType.DeleteNode,
							target,
						});
						break;
					}
					case TreeNodeType.Section: {
						out.push({
							actionType: TreeActionType.DeleteNode,
							target,
						});
						break;
					}
					default: {
						break;
					}
				}
				break;
			}

			// ----------------------------
			// Rename roots (inside→inside only)
			// ----------------------------
			case MaterializedEventType.Rename: {
				const hasDelimiter = hasSuffixDelimiterInRenameTo(ev);

				const fromCspRes = tryParseCanonicalSplitPath(
					ev.libraryScopedFrom,
				);
				if (fromCspRes.isErr()) break;

				const target = makeLocatorFromLibraryScopedCanonicalSplitPath(
					fromCspRes.value,
				);

				switch (target.targetType) {
					case TreeNodeType.File: {
						const newName = extractNodeNameFromRenameTo(ev);

						if (!hasDelimiter) {
							out.push({
								actionType: TreeActionType.RenameNode,
								newName,
								target,
							});
							break;
						}

						const newParent = deriveNewParentFromRenameTo(ev);
						const observedVaultSplitPath =
							getObservedSplitPathFromRenameTo(ev);

						out.push({
							actionType: TreeActionType.MoveNode,
							newName,
							newParent,
							observedVaultSplitPath,
							target,
						});
						break;
					}

					case TreeNodeType.Scroll: {
						const newName = extractNodeNameFromRenameTo(ev);

						if (!hasDelimiter) {
							out.push({
								actionType: TreeActionType.RenameNode,
								newName,
								target,
							});
							break;
						}

						const newParent = deriveNewParentFromRenameTo(ev);
						const observedVaultSplitPath =
							getObservedSplitPathFromRenameTo(ev);

						out.push({
							actionType: TreeActionType.MoveNode,
							newName,
							newParent,
							observedVaultSplitPath,
							target,
						});
						break;
					}

					case TreeNodeType.Section: {
						const newName = extractNodeNameFromRenameTo(ev);

						if (!hasDelimiter) {
							out.push({
								actionType: TreeActionType.RenameNode,
								newName,
								target,
							});
							break;
						}

						const newParent = deriveNewParentFromRenameTo(ev);
						const observedVaultSplitPath =
							getObservedSplitPathFromRenameTo(ev);

						out.push({
							actionType: TreeActionType.MoveNode,
							newName,
							newParent,
							observedVaultSplitPath,
							target,
						});
						break;
					}

					default: {
						break;
					}
				}

				break;
			}

			default: {
				break;
			}
		}
	}

	return out;
};

// ------------------------------------
// TODO helpers (still needed)
// ------------------------------------

declare function hasSuffixDelimiterInRenameTo(
	ev:
		| RenameFileNodeMaterializedEvent
		| RenameScrollNodeMaterializedEvent
		| RenameSectionNodeMaterializedEvent,
): boolean;

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
