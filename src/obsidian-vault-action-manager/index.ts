import type { FileSplitPath } from "./types/split-path";
import type { VaultAction } from "./types/vault-action";

/**
 * Generic vault-facing events. No librarian coupling.
 */
export type VaultEvent =
	| {
			kind: "file-created";
			splitPath: FileSplitPath;
	  }
	| {
			kind: "file-renamed";
			from: FileSplitPath;
			to: FileSplitPath;
	  }
	| {
			kind: "file-deleted";
			splitPath: FileSplitPath;
	  };

export type VaultEventHandler = (event: VaultEvent) => Promise<void>;

export type Teardown = () => void;

/**
 * Bridge for Obsidian file events and VaultAction execution.
 * Implementation is responsible for wiring to the platform (Obsidian app)
 * and managing queue/flush policies.
 */
export interface ObsidianVaultActionManager {
	subscribe(handler: VaultEventHandler): Teardown;
	dispatch(actions: readonly VaultAction[]): Promise<void>;
}
