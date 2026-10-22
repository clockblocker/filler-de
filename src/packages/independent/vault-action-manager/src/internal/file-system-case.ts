import { Predicate } from "effect";
import type { App } from "obsidian";
import type { VaultFileSystem } from "../vault-path";

/**
 * How the vault's file system compares names.
 *
 * Obsidian's desktop adapter keeps an undocumented boolean,
 * `adapter.insensitive` (Obsidian 1.14.4). It starts from the platform
 * (macOS or Windows) and then probes the vault folder itself: it writes
 * `.OBSIDIANTEST` and checks whether `.obsidiantest` exists. That answers
 * for the volume the vault is on, such as a case-sensitive APFS volume, so
 * on desktop it is preferred; without it, the platform decides as
 * Obsidian's first guess does.
 *
 * The mobile adapter sets the flag to `false` without probing, and Android's
 * shared storage ignores case. Off desktop, and wherever the platform is
 * unknown, VAM therefore assumes case is ignored: its two users, protected
 * paths and the delimiter collision check, then refuse more, never less.
 */
export function detectVaultFileSystem(app: App): VaultFileSystem {
	const platform: unknown = globalThis.process?.platform;
	if (!Predicate.isString(platform)) return { caseInsensitive: true };
	const adapter: unknown = app.vault?.adapter;
	if (
		Predicate.hasProperty(adapter, "insensitive") &&
		Predicate.isBoolean(adapter.insensitive)
	) {
		return { caseInsensitive: adapter.insensitive };
	}
	return { caseInsensitive: platform === "darwin" || platform === "win32" };
}
