import type { VaultAction } from "./vault-action";

/**
 * Dependency relationship between two actions.
 *
 * An action depends on another if it must execute after that action.
 * For example, ProcessMdFile depends on CreateMdFile for the same file.
 */
export type ActionDependency = {
	/** Action that depends on others */
	action: VaultAction;
	/** Actions that must execute before this one */
	dependsOn: VaultAction[];
	/** Actions that require this one (inverse of dependsOn) */
	requiredBy: VaultAction[];
};

/**
 * Dependency graph: map from action key to dependency info.
 *
 * Action key format: same as getActionKey() from vault-action.ts
 * - For rename actions: "RenameMdFile:path/to/file.md"
 * - For other actions: "CreateMdFile:path/to/file.md"
 */
export type DependencyGraph = Map<string, ActionDependency>;

/**
 * Action key for dependency tracking.
 * Uses same key format as getActionKey() for consistency.
 */
export type ActionKey = string;
