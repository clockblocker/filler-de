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
export function formatRename(from: AnySplitPath, to: AnySplitPath): string {
	return `${makeKeyFor(from)} → ${makeKeyFor(to)}`;
}

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

/**
 * Keep the LAST occurrence for each key.
 * (matches your "newest wins" default behavior)
 */
export function dedupeByKey<T>(
	items: readonly T[],
	keyFn: (item: T) => string,
): T[] {
	const map = new Map<string, T>();
	for (const item of items) {
		map.set(keyFn(item), item);
	}
	return Array.from(map.values());
}

/**
 * Dedupe items by a custom equality predicate.
 * Keeps the FIRST occurrence of each equivalence class by default.
 *
 * If you need "keep last", either reverse input, dedupe, then reverse back,
 * or add an options param later.
 */
export function dedupeExact<T>(
	items: readonly T[],
	eq: (a: T, b: T) => boolean,
): T[] {
	const out: T[] = [];
	for (const item of items) {
		if (!out.some((x) => eq(x, item))) {
			out.push(item);
		}
	}
	return out;
}
