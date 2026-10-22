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
	const files =
		paths.length === 1
			? `the protected file ${paths[0]}`
			: `${paths.length} protected files: ${paths.join(", ")}`;
	return `Textfresser: ${files} ${paths.length === 1 ? "was" : "were"} changed by ${who}. Check ${paths.length === 1 ? "it" : "them"} against the checksum.`;
}

/**
 * Warns with a Notice that stays until dismissed whenever a protected file
 * changes other than by the user's own editing. VAM refuses to change these
 * paths itself, but Obsidian's link updater rewrites links in any file.
 */
export function watchProtectedPaths(
	vam: Pick<VaultActionManager, "subscribeToProtectedPathModifications">,
	warn: (message: string) => void,
): ReturnType<VaultActionManager["subscribeToProtectedPathModifications"]> {
	return vam.subscribeToProtectedPathModifications((event) =>
		Effect.sync(() => {
			const message = describeProtectedModifications(event.modifications);
			if (message) warn(message);
		}),
	);
}
