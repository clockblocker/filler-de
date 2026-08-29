import { splitPathCodec } from "../../split-path-codec";
import type { AnySplitPath } from "../../types/split-path";

// --- keys ---

export function makeKeyFor(arg: AnySplitPath): string;
export function makeKeyFor(arg: { splitPath: AnySplitPath }): string;
export function makeKeyFor(arg: { from: AnySplitPath }): string;
export function makeKeyFor(
	arg: AnySplitPath | { splitPath: AnySplitPath } | { from: AnySplitPath },
): string {
	if (typeof arg === "object" && arg !== null) {
		if ("from" in arg) {
			return splitPathCodec.format(arg.from);
		}
		if ("splitPath" in arg) {
			return splitPathCodec.format(arg.splitPath);
		}
	}
	return splitPathCodec.format(arg);
}

// optional, logs only

// --- rename comparator ---

export function sameRename(
	a: { from: AnySplitPath; to: AnySplitPath },
	b: { from: AnySplitPath; to: AnySplitPath },
): boolean {
	return (
		splitPathCodec.format(a.from) === splitPathCodec.format(b.from) &&
		splitPathCodec.format(a.to) === splitPathCodec.format(b.to)
	);
}

// --- generic dedupe helpers ---

export { dedupeByKeyLast as dedupeByKey } from "../../internal/collections";
