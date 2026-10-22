import { Predicate } from "effect";
import type { App } from "obsidian";
import type { VaultFileSystem } from "../vault-path";

/**
 * How the vault's file system compares names.
 *
 * Obsidian's desktop and mobile adapters keep an undocumented boolean,
 * `adapter.insensitive`. The desktop adapter starts from the platform
 * (macOS or Windows) and then probes the vault folder itself: it writes
 * `.OBSIDIANTEST` and checks whether `.obsidiantest` exists. That answers
 * for the volume the vault is on, such as a case-sensitive APFS volume, so
 * it is preferred.
 *
 * Without that flag, the platform decides as Obsidian's first guess does:
 * macOS and Windows ignore case, other systems do not.
 */
export function detectVaultFileSystem(app: App): VaultFileSystem {
	const adapter: unknown = app.vault?.adapter;
	if (
		Predicate.hasProperty(adapter, "insensitive") &&
		Predicate.isBoolean(adapter.insensitive)
	) {
		return { caseInsensitive: adapter.insensitive };
	}
	const platform = globalThis.process?.platform;
	return { caseInsensitive: platform === "darwin" || platform === "win32" };
}
