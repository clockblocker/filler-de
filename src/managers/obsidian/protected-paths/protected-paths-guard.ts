import {
	type ProtectedPathModification,
	splitPathCodec,
	type VaultActionManager,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";

/**
 * Vault paths Textfresser never changes. `Exemplar/` holds the design
 * reference notes, such as `Exemplar/Kohlekraftwerk/`. VAM refuses any
 * Dispatch Batch that names a path under it.
 */
export const PROTECTED_PATH_PREFIXES: readonly string[] = ["Exemplar"];

/**
 * Why Textfresser may not write `path`, or `undefined` when it may. Commands
 * that write elsewhere too (Classify writes `Worter/` before its Scroll)
 * ask first, so a refused Scroll write never leaves the rest half-done.
 */
export function protectedPathRefusal(
	vam: Pick<VaultActionManager, "protectedPrefixOf">,
	path: string,
): string | undefined {
	const prefix = vam.protectedPrefixOf(path);
	return prefix === undefined
		? undefined
		: `Textfresser does not write to ${path}: it lies in the protected folder ${prefix}/`;
}

/** How many paths a warning names before it counts the rest. */
const NAMED_PATHS = 10;

/** `paths` as a message names them: at most `NAMED_PATHS`, then a count. */
function nameFiles(paths: readonly string[]): string {
	const named = paths.slice(0, NAMED_PATHS).join(", ");
	const rest = paths.length - NAMED_PATHS;
	return paths.length === 1
		? `the protected file ${paths[0]}`
		: `${paths.length} protected files: ${rest > 0 ? `${named} and ${rest} more` : named}`;
}

/**
 * The message for protected files changed by something other than the
 * user's own editing; `null` when every modification's writer is
 * `OpenInEditor`. Files VAM put back after Obsidian's link updating rewrote
 * them are named apart: their content is as it was, but their links to the
 * moved note keep the old text.
 */
export function describeProtectedModifications(
	modifications: readonly ProtectedPathModification[],
): string | null {
	const parts = [
		describeChanged(
			modifications.filter(
				({ writer }) =>
					writer !== "OpenInEditor" &&
					writer !== "RestoredAfterLinkUpdate",
			),
		),
		describeRestored(
			modifications.filter(
				({ writer }) => writer === "RestoredAfterLinkUpdate",
			),
		),
	].filter((part) => part !== null);
	const [first, ...rest] = parts;
	if (first === undefined) return null;
	return [
		`Textfresser: ${first}`,
		...rest.map(
			(part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
		),
	].join(" ");
}

function describeChanged(
	changed: readonly ProtectedPathModification[],
): string | null {
	if (changed.length === 0) return null;
	const paths = changed.map(({ splitPath }) =>
		splitPathCodec.format(splitPath),
	);
	const byVamRename = changed.every(
		({ writer }) => writer === "VamRenameLinkUpdate",
	);
	const who = byVamRename
		? "Obsidian's link updating, after a Textfresser rename"
		: "something other than your editing (Obsidian's link updating, Sync, or another plugin)";
	return `${nameFiles(paths)} ${paths.length === 1 ? "was" : "were"} changed by ${who}. Check ${paths.length === 1 ? "it" : "them"} against the checksum.`;
}

function describeRestored(
	restored: readonly ProtectedPathModification[],
): string | null {
	const [only] = restored;
	if (only === undefined) return null;
	if (restored.length === 1) {
		const target = only.renamed
			? `${only.renamed.from}, which Textfresser moved to ${only.renamed.to}`
			: "a note Textfresser moved";
		return `${nameFiles([splitPathCodec.format(only.splitPath)])} links to ${target}. Obsidian's link updating rewrote that link; Textfresser put the file back as it was, so the link keeps its old text.`;
	}
	const paths = restored.map(({ splitPath }) =>
		splitPathCodec.format(splitPath),
	);
	return `Obsidian's link updating rewrote ${nameFiles(paths)} after Textfresser moved notes they link to; Textfresser put them back as they were, so those links keep their old text.`;
}

/** One warning on screen, which later warnings update while it shows. */
export type ProtectedPathWarning = {
	/** False once the user dismissed it. */
	readonly showing: () => boolean;
	readonly update: (message: string) => void;
};

/**
 * Warns, in a Notice `open` shows and in the log, whenever a protected
 * file changes other than by the user's own editing, and tells when VAM
 * put one back after Obsidian's link updating rewrote it. VAM refuses to
 * change these paths itself, but cannot stop every writer. While a warning
 * shows, later changes update it to name every file changed since it
 * opened, so a rename that rewrites files over several windows raises one
 * warning, not one each. Each warning and update is logged.
 */
export function watchProtectedPaths(
	vam: Pick<VaultActionManager, "subscribeToProtectedPathModifications">,
	open: (message: string) => ProtectedPathWarning,
): ReturnType<VaultActionManager["subscribeToProtectedPathModifications"]> {
	let current: ProtectedPathWarning | undefined;
	const changed = new Map<string, ProtectedPathModification>();
	return vam.subscribeToProtectedPathModifications((event) =>
		Effect.gen(function* () {
			const suspicious = event.modifications.filter(
				({ writer }) => writer !== "OpenInEditor",
			);
			if (suspicious.length === 0) return;
			const showing = current?.showing() === true;
			if (!showing) changed.clear();
			for (const modification of suspicious)
				changed.set(
					splitPathCodec.format(modification.splitPath),
					modification,
				);
			const message = describeProtectedModifications([
				...changed.values(),
			]);
			if (!message) return;
			yield* Effect.logWarning(`[TextEaterPlugin] ${message}`);
			if (showing && current) current.update(message);
			else current = open(message);
		}),
	);
}
