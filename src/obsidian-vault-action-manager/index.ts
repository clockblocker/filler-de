import { z } from "zod";
import { CREATE, FILE, RENAME, TRASH } from "./types/literals";
import type { FileSplitPath } from "./types/split-path";
import type { VaultAction } from "./types/vault-action";

export const VaultEventTypeSchema = z.enum([
	`${FILE}${CREATE}d`,
	`${FILE}${RENAME}d`,
	`${FILE}${TRASH}ed`,
] as const);

export const VaultEventType = VaultEventTypeSchema.enum;
export type VaultEventType = z.infer<typeof VaultEventTypeSchema>;

export type VaultEvent =
	| {
			type: typeof VaultEventType.FileCreated;
			splitPath: FileSplitPath;
	  }
	| {
			type: typeof VaultEventType.FileRenamed;
			from: FileSplitPath;
			to: FileSplitPath;
	  }
	| {
			type: typeof VaultEventType.FileTrashed;
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
