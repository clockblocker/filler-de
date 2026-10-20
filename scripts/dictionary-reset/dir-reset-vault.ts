/**
 * A read-only reset vault over a directory on disk, for running the
 * dictionary reset's Dry run outside Obsidian: a fixture, or a copy of a
 * vault. Links resolve as Obsidian resolves them: an exact path first,
 * then the file with that basename whose path is shortest. Every write
 * fails, so nothing on disk can change.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { Effect } from "effect";
import {
	ResetFailed,
	type ResetVault,
} from "../../src/commanders/dictionary-reset/execute";

function walk(root: string, folder: string): string[] {
	return readdirSync(join(root, folder), { withFileTypes: true }).flatMap(
		(entry) => {
			if (entry.name.startsWith(".")) return [];
			const path = folder === "" ? entry.name : `${folder}/${entry.name}`;
			return entry.isDirectory() ? walk(root, path) : [path];
		},
	);
}

const refused = (what: string) =>
	Effect.fail(
		new ResetFailed({
			cause: what,
			message: `The directory vault is read-only: ${what}`,
		}),
	);

export function dirResetVault(root: string): ResetVault {
	const files = walk(root, "").map((path) => path.split(sep).join("/"));
	const byBasename = new Map<string, string[]>();
	for (const path of files) {
		if (!path.endsWith(".md")) continue;
		const basename = path.split("/").at(-1)?.slice(0, -3) ?? path;
		byBasename.set(basename, [...(byBasename.get(basename) ?? []), path]);
	}
	const isFolder = (path: string) => {
		try {
			return statSync(join(root, path)).isDirectory();
		} catch {
			return false;
		}
	};
	return {
		createNote: (path) => refused(`create ${path}`),
		exists: (path) =>
			Effect.sync(() => files.includes(path) || isFolder(path)),
		listFolder: (folder) =>
			Effect.sync(() => {
				if (!isFolder(folder)) return undefined;
				const inside = walk(root, folder).map((path) =>
					relative(root, join(root, path)).split(sep).join("/"),
				);
				return {
					markdown: inside
						.filter((path) => path.endsWith(".md"))
						.map((path) => ({
							content: readFileSync(join(root, path), "utf8"),
							path,
						})),
					other: inside.filter((path) => !path.endsWith(".md")),
				};
			}),
		moveFolder: (from, to) => refused(`move ${from} to ${to}`),
		read: (path) =>
			Effect.sync(() =>
				files.includes(path)
					? readFileSync(join(root, path), "utf8")
					: undefined,
			),
		resolveLink: (linkpath) =>
			Effect.sync(() => {
				const exact = linkpath.endsWith(".md") ? linkpath : `${linkpath}.md`;
				if (files.includes(exact)) return exact;
				const basename = linkpath.split("/").at(-1) ?? linkpath;
				return [...(byBasename.get(basename) ?? [])].sort(
					(a, b) => a.length - b.length || (a < b ? -1 : 1),
				)[0];
			}),
	};
}
