import type { Result } from "neverthrow";
import type {
	SplitPathToFile,
	SplitPathToMdFile,
} from "../../../../../obsidian-vault-action-manager/types/split-path";
import { TreeNodeType } from "../../tree-node/types/atoms";
import type {
	CreateFileNodeMaterializedEvent,
	CreateScrollNodeMaterializedEvent,
} from "../bulk-vault-action-adapter/layers/materialized-node-events/types";
import { tryParseCanonicalSplitPath } from "../helpers/canonical-split-path/try-parse-canonical-split-path";
import type {
	CanonicalSplitPathToFile,
	CanonicalSplitPathToMdFile,
} from "../helpers/canonical-split-path/types";
import { makeLocatorFromLibraryScopedCanonicalSplitPath } from "../helpers/make-locator";
import {
	type CreateTreeLeafAction,
	TreeActionType,
} from "../types/tree-action";

/**
 * Canonicalizes an observed leaf SplitPath during Create (import / initial load)
 * according to the Create policy.
 *
 * Policy rules:
 * - NameKing:
 *   - Used for direct children of `Library/` (pathParts.length === 0).
 *   - Basename suffix defines section hierarchy.
 *   - Observed pathParts are ignored.
 *
 * - PathKing:
 *   - Used for nested paths under `Library/`.
 *   - Observed pathParts define section hierarchy.
 *   - Basename suffix is ignored and will be healed.
 *
 * Returns a canonical leaf SplitPath (nodeName + sectionNames) suitable
 * for building a TreeNodeLocator and later healing.
 *
 * @example
 * // NameKing (flat import)
 * // Observed: Library/MyNote-Child-Parent.md
 * tryMakeCanonicalLeafSplitPathFromObservedCreate(
 *   { basename: "MyNote-Child-Parent", pathParts: [], type: MdFile },
 *   "NameKing"
 * )
 * // => Canonical:
 * // nodeName: "MyNote"
 * // sectionNames: ["Parent", "Child"]
 *
 * @example
 * // PathKing (nested import)
 * // Observed: Library/Parent/Child/MyNote.md
 * tryMakeCanonicalLeafSplitPathFromObservedCreate(
 *   { basename: "MyNote", pathParts: ["Parent", "Child"], type: MdFile },
 *   "PathKing"
 * )
 * // => Canonical:
 * // nodeName: "MyNote"
 * // sectionNames: ["Parent", "Child"]
 *
 * @example
 * // PathKing heals wrong suffix
 * // Observed: Library/Parent/Child/MyNote-Other.md
 * tryMakeCanonicalLeafSplitPathFromObservedCreate(
 *   { basename: "MyNote-Other", pathParts: ["Parent", "Child"], type: File },
 *   "PathKing"
 * )
 * // => Canonical:
 * // nodeName: "MyNote"
 * // sectionNames: ["Parent", "Child"]
 * // (suffix "-Other" will be healed later)
 */
export function buildCreateActions(
	ev: CreateFileNodeMaterializedEvent | CreateScrollNodeMaterializedEvent,
): CreateTreeLeafAction[] {
	const out: CreateTreeLeafAction[] = [];

	const observedVaultSplitPath = ev.libraryScopedSplitPath; // already leaf-typed

	const policy = inferCreatePolicy(observedVaultSplitPath); // NameKing|PathKing

	const canonicalRes = tryMakeCanonicalLeafSplitPathFromObservedCreate(
		observedVaultSplitPath,
		policy,
	); // Result<CanonicalSplitPathToFile|MdFile,string>
	if (canonicalRes.isErr()) return out;

	const target = makeLocatorFromLibraryScopedCanonicalSplitPath(
		canonicalRes.value,
	);

	switch (target.targetType) {
		case TreeNodeType.File: {
			if (observedVaultSplitPath.type !== "File") {
				break;
			}
			out.push({
				actionType: TreeActionType.CreateNode,
				observedVaultSplitPath: observedVaultSplitPath,
				target,
			});
			break;
		}
		case TreeNodeType.Scroll: {
			if (observedVaultSplitPath.type !== "MdFile") {
				break;
			}
			out.push({
				actionType: TreeActionType.CreateNode,
				observedVaultSplitPath,
				target,
			});
			break;
		}
		default: {
			break;
		}
	}

	return out;
}

// ------------------------------------
// helpers (TODO)
// ------------------------------------

declare function inferCreatePolicy(
	sp: SplitPathToFile | SplitPathToMdFile,
): "NameKing" | "PathKing";

/**
 * Produces canonical leaf split path (nodeName + sectionNames) from an observed create,
 * applying import policy:
 * - NameKing: derive sectionNames from basename suffix; ignore observed pathParts.
 * - PathKing: derive sectionNames from observed pathParts; derive canonical suffix from it.
 */
declare function tryMakeCanonicalLeafSplitPathFromObservedCreate(
	sp: SplitPathToFile | SplitPathToMdFile,
	policy: "NameKing" | "PathKing",
): Result<CanonicalSplitPathToFile | CanonicalSplitPathToMdFile, string>;
