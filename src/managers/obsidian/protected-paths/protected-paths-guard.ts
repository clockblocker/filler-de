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

/**
 * The warning for protected files changed by something other than the
 * user's own editing; `null` when every modification is `OpenInEditor`.
 */
export function describeProtectedModifications(
	modifications: readonly ProtectedPathModification[],
): string | null {
	const suspicious = modifications.filter(
		({ origin }) => origin !== "OpenInEditor",
	);
	if (suspicious.length === 0) return null;
	const paths = suspicious.map(({ splitPath }) =>
		splitPathCodec.format(splitPath),
	);
	const byVamRename = suspicious.every(
		({ origin }) => origin === "VamRenameLinkUpdate",
	);
	const who = byVamRename
		? "Obsidian's link updating, after a Textfresser rename"
		: "something other than your editing (Obsidian's link updating, Sync, or another plugin)";
	const named = paths.slice(0, NAMED_PATHS).join(", ");
	const rest = paths.length - NAMED_PATHS;
	const files =
		paths.length === 1
			? `the protected file ${paths[0]}`
			: `${paths.length} protected files: ${rest > 0 ? `${named} and ${rest} more` : named}`;
	return `Textfresser: ${files} ${paths.length === 1 ? "was" : "were"} changed by ${who}. Check ${paths.length === 1 ? "it" : "them"} against the checksum.`;
}

/** One warning on screen, which later warnings update while it shows. */
export type ProtectedPathWarning = {
	/** False once the user dismissed it. */
	readonly showing: () => boolean;
	readonly update: (message: string) => void;
};

/**
 * Warns whenever a protected file changes other than by the user's own
 * editing. VAM refuses to change these paths itself, but Obsidian's link
 * updater rewrites links in any file. While a warning shows, later changes
 * update it to name every file changed since it opened, so a rename that
 * rewrites files over several windows raises one warning, not one each.
 */
export function watchProtectedPaths(
	vam: Pick<VaultActionManager, "subscribeToProtectedPathModifications">,
	open: (message: string) => ProtectedPathWarning,
): ReturnType<VaultActionManager["subscribeToProtectedPathModifications"]> {
	let current: ProtectedPathWarning | undefined;
	const changed = new Map<string, ProtectedPathModification>();
	return vam.subscribeToProtectedPathModifications((event) =>
		Effect.sync(() => {
			const suspicious = event.modifications.filter(
				({ origin }) => origin !== "OpenInEditor",
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
			if (showing && current) current.update(message);
			else current = open(message);
		}),
	);
}
