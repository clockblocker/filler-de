import type { AnySplitPath } from "../../types/split-path";
import { makeSystemPathForSplitPath } from "./split-path-and-system-path";

// --- keys ---

export function makeKeyFor(arg: AnySplitPath): string;
export function makeKeyFor(arg: { splitPath: AnySplitPath }): string;
export function makeKeyFor(arg: { from: AnySplitPath }): string;
export function makeKeyFor(
	arg: AnySplitPath | { splitPath: AnySplitPath } | { from: AnySplitPath },
): string {
	if (typeof arg === "object" && arg !== null) {
		if ("from" in arg) {
			return makeSystemPathForSplitPath(arg.from);
		}
		if ("splitPath" in arg) {
			return makeSystemPathForSplitPath(arg.splitPath);
		}
	}
	return makeSystemPathForSplitPath(arg);
}

// optional, logs only

// --- rename comparator ---

export function sameRename(
	a: { from: AnySplitPath; to: AnySplitPath },
	b: { from: AnySplitPath; to: AnySplitPath },
): boolean {
	return (
		makeSystemPathForSplitPath(a.from) ===
			makeSystemPathForSplitPath(b.from) &&
		makeSystemPathForSplitPath(a.to) === makeSystemPathForSplitPath(b.to)
	);
}

// --- generic dedupe helpers ---

export { dedupeByKeyLast as dedupeByKey } from "../../internal/collections";

