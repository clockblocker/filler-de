import {
	pathToFolderFromPathParts,
	systemPathFromSplitPathInternal,
} from "../../helpers/pathfinder";
import type { SplitPath } from "../../types/split-path";
import type { VaultAction } from "../../types/vault-action";
import { VaultActionType } from "../../types/vault-action";

/**
 * Tracks paths of actions we dispatch to filter self-events from Obsidian.
 *
 * When we dispatch actions, Obsidian emits events. We need to filter these
 * out so only user-triggered events reach subscribers.
 *
 * Uses path-based matching (normalized system paths) for all action types.
 * For renames, tracks both `from` and `to` paths.
 *
 * TTL: 5s with pop-on-match (one-time use per path).
 */
export class SelfEventTracker {
	private readonly trackedPaths = new Map<string, NodeJS.Timeout>();
	private readonly ttlMs = 5000; // 5 seconds

	/**
	 * Register actions we're about to dispatch.
	 * Extracts system paths from all action types and tracks them.
	 */
	register(actions: readonly VaultAction[]): void {
		for (const action of actions) {
			const paths = this.extractPaths(action);
			for (const path of paths) {
				this.trackPath(path);
			}
		}
	}

	/**
	 * Check if a path should be ignored (is a self-event).
	 * Returns true if path matches a tracked path.
	 *
	 * Pop-on-match: removes path from tracking on match (one-time use).
	 */
	shouldIgnore(path: string): boolean {
		const normalized = this.normalizePath(path);
		const isTracked = this.trackedPaths.has(normalized);

		if (isTracked) {
			// Pop-on-match: remove and clear timeout
			this.untrackPath(normalized);
		}

		return isTracked;
	}

	/**
	 * Extract system paths from an action.
	 * For create operations: returns target path + all parent folder paths
	 *   (Obsidian auto-creates parent folders, so we must track them).
	 * For renames: returns both `from` and `to` paths + their parent folders.
	 * For others: returns target path.
	 */
	private extractPaths(action: VaultAction): string[] {
		const { type, payload } = action;

		switch (type) {
			case VaultActionType.CreateFolder:
			case VaultActionType.CreateFile:
			case VaultActionType.UpsertMdFile:
			case VaultActionType.ProcessMdFile:
				// Track target path + all parent folder paths
				// (Obsidian auto-creates parent folders for create operations)
				return this.extractPathsWithParents(payload.splitPath);

			case VaultActionType.TrashFolder:
			case VaultActionType.TrashFile:
			case VaultActionType.TrashMdFile:
				// Trash operations don't create parent folders, only track target
				return [systemPathFromSplitPathInternal(payload.splitPath)];

			case VaultActionType.RenameFolder:
			case VaultActionType.RenameFile:
			case VaultActionType.RenameMdFile:
				// Track both from and to paths + their parent folders
				// (rename to new location may create parent folders)
				return [
					...this.extractPathsWithParents(payload.from),
					...this.extractPathsWithParents(payload.to),
				];
		}
	}

	/**
	 * Extract target path + all parent folder paths.
	 * Obsidian's vault.create() and vault.createFolder() automatically create
	 * parent folders, which emit events we must filter.
	 */
	private extractPathsWithParents(splitPath: SplitPath): string[] {
		const paths: string[] = [];

		// Extract all parent folder paths FIRST (Obsidian creates them before the target)
		// For pathParts ["a", "b", "c"], generate: "a", "a/b", "a/b/c"
		const { pathParts } = splitPath;
		for (let i = 1; i <= pathParts.length; i++) {
			const parentPathParts = pathParts.slice(0, i);
			const parentPath = pathToFolderFromPathParts(parentPathParts);
			if (parentPath) {
				paths.push(parentPath);
			}
		}

		// Then add the target path (file or folder being created)
		const targetPath = systemPathFromSplitPathInternal(splitPath);
		paths.push(targetPath);

		return paths;
	}

	/**
	 * Track a path with TTL.
	 * If path already tracked, resets TTL.
	 */
	private trackPath(path: string): void {
		const normalized = this.normalizePath(path);

		// Clear existing timeout if path already tracked
		const existingTimeout = this.trackedPaths.get(normalized);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		// Set new timeout for TTL cleanup
		const timeout = setTimeout(() => {
			this.trackedPaths.delete(normalized);
		}, this.ttlMs);

		this.trackedPaths.set(normalized, timeout);
	}

	/**
	 * Remove path from tracking and clear timeout.
	 */
	private untrackPath(normalized: string): void {
		const timeout = this.trackedPaths.get(normalized);
		if (timeout) {
			clearTimeout(timeout);
		}
		this.trackedPaths.delete(normalized);
	}

	/**
	 * Normalize path for matching.
	 * Obsidian paths are already normalized, but we ensure consistency.
	 */
	private normalizePath(path: string): string {
		// Remove leading/trailing slashes, normalize separators
		return path.replace(/^[\\/]+|[\\/]+$/g, "").replace(/\\/g, "/");
	}
}
