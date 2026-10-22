import {
	type AnySplitPath,
	splitPathCodec,
	VaultPath,
} from "@textfresser/vault-action-manager";

/**
 * Whether an observed and a canonical path are one path of one kind.
 * Case-sensitive, so Healing still renames a leaf whose name differs from
 * its canonical name only in case.
 */
export function splitPathsEqual(a: AnySplitPath, b: AnySplitPath): boolean {
	return (
		a.kind === b.kind &&
		VaultPath.caseSensitive.same(
			splitPathCodec.format(a),
			splitPathCodec.format(b),
		)
	);
}
