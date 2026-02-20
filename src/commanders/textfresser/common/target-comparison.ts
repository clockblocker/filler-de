/**
 * Canonicalize link-like targets for case-insensitive comparison in Textfresser domain logic.
 */
export function canonicalizeTargetForComparison(target: string): string {
	return target.trim().toLowerCase();
}
