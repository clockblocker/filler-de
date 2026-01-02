import { err, ok, type Result } from "neverthrow";
import type {
	SplitPathToFile,
	SplitPathToMdFile,
} from "../../../../../obsidian-vault-action-manager/types/split-path";
import {
	type NodeName,
	NodeNameSchema,
} from "../../../types/schemas/node-name";
import { TreeNodeType } from "../../tree-node/types/atoms";
import type { CreateLeafNodeMaterializedEvent } from "../bulk-vault-action-adapter/layers/materialized-node-events/types";
import type {
	CanonicalSplitPathToFile,
	CanonicalSplitPathToMdFile,
} from "../helpers/canonical-split-path/types";
import { makeLocatorFromLibraryScopedCanonicalSplitPath } from "../helpers/make-locator";
import {
	makePathPartsFromSuffixParts,
	tryMakeSeparatedSuffixedBasename,
} from "../helpers/suffix-utils/suffix-utils";
import {
	type CreateTreeLeafAction,
	TreeActionType,
} from "../types/tree-action";
import { ChangePolicy } from "./helpers/policy";
import { inferCreatePolicy } from "./helpers/policy/infer-create";

/**
 * Canonicalizes an observed leaf SplitPath during Create (import / initial load)
 * according to the Create policy.
 *
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
export function traslateCreateMaterializedEvent(
	ev: CreateLeafNodeMaterializedEvent,
): CreateTreeLeafAction[] {
	const out: CreateTreeLeafAction[] = [];

	const observedVaultSplitPath = ev.libraryScopedSplitPath; // already leaf-typed

	const canonicalRes = tryMakeCanonicalLeafSplitPathFromObservedCreate(
		observedVaultSplitPath,
	);

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

/**
 * Produces canonical leaf split path (nodeName + sectionNames) from an observed create,
 * applying import policy:
 * - NameKing: derive sectionNames from basename suffix; ignore observed pathParts.
 * - PathKing: derive sectionNames from observed pathParts; ignore basename suffix.
 */
export function tryMakeCanonicalLeafSplitPathFromObservedCreate(
	sp: SplitPathToFile | SplitPathToMdFile,
): Result<CanonicalSplitPathToFile | CanonicalSplitPathToMdFile, string> {
	const policy = inferCreatePolicy(sp); // NameKing | PathKing

	const sepRes = tryMakeSeparatedSuffixedBasename(sp);
	if (sepRes.isErr()) return err(sepRes.error);

	if (policy === ChangePolicy.NameKing) {
		const sectionNames = makePathPartsFromSuffixParts(
			sepRes.value,
		) as NodeName[];

		return ok({
			...sp,
			nodeName: sepRes.value.nodeName,
			sectionNames,
		});
	}

	const sectionNames: NodeName[] = [];
	for (const seg of sp.pathParts) {
		const r = NodeNameSchema.safeParse(seg);
		if (!r.success) {
			return err(
				r.error.issues[0]?.message ?? "Invalid section NodeName",
			);
		}
		sectionNames.push(r.data);
	}

	return ok({
		...sp,
		nodeName: sepRes.value.nodeName,
		sectionNames,
	});
}
