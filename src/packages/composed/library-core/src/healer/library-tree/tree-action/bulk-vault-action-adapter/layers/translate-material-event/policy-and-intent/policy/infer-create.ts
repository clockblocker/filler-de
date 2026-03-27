import type { CreateLeafNodeMaterializedEvent } from "../../../materialized-node-events/types";
import { ChangePolicy } from "./types";

/**
 * Infers canonicalization policy for a Create (import / initial load) event.
 *
 * Policy meaning:
 * - NameKing: basename suffix defines section hierarchy.
 * - PathKing: folder path defines section hierarchy; basename suffix is ignored.
 *
 * Rule:
 * - Direct child of Library root → NameKing.
 * - Nested under Library folders → PathKing.
 *
 * ───────────────
 * Create examples
 * ───────────────
 *
 * NameKing (flat import):
 *   Library/Note-Child-Parent.md
 *
 *   Canonicalization:
 *   - nodeName: "Note"
 *   - sectionNames: ["Parent", "Child"]
 *
 * PathKing (nested import):
 *   Library/Parent/Child/Note.md
 *
 *   Canonicalization:
 *   - nodeName: "Note"
 *   - sectionNames: ["Parent", "Child"]
 *
 * PathKing (heals wrong suffix):
 *   Library/Parent/Child/Note-Other.md
 *
 *   Canonicalization:
 *   - nodeName: "Note"
 *   - sectionNames: ["Parent", "Child"]
 *   - Suffix "-Other" will be healed later.
 *
 * Note:
 * This policy affects **only canonical split-path construction** during Create.
 * No Tree mutations or healing actions are produced here.
 */
export function inferCreatePolicy(
	splitPath: CreateLeafNodeMaterializedEvent["splitPath"],
): ChangePolicy {
	// direct child of "Library/" => NameKing
	// nested under "Library/..." => PathKing
	return splitPath.pathParts.length === 1
		? ChangePolicy.NameKing
		: ChangePolicy.PathKing;
}
