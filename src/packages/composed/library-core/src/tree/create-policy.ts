import { ChangePolicy } from "./change-policy";

/** NameKing for root leaves; PathKing for leaves already nested in sections. */
export function inferCreatePolicy(splitPath: {
	readonly pathParts: readonly string[];
}): ChangePolicy {
	return splitPath.pathParts.length === 1
		? ChangePolicy.NameKing
		: ChangePolicy.PathKing;
}
