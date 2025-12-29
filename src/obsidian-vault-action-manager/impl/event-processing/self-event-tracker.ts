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
	private readonly trackedPaths = new Map<
		string,
		ReturnType<typeof setTimeout>
	>();
	private readonly trackedPrefixes = new Map<
		string,
		ReturnType<typeof setTimeout>
	>();
	private readonly ttlMs = 5000;

	register(actions: readonly VaultAction[]): void {
		for (const action of actions) {
			for (const path of this.extractPaths(action)) this.trackPath(path);
			for (const prefix of this.extractFolderPrefixes(action))
				this.trackPrefix(prefix);
		}
	}

	shouldIgnore(path: string): boolean {
		const normalized = this.normalizePath(path);

		// Exact match (pop-on-match)
		if (this.trackedPaths.has(normalized)) {
			this.untrackPath(normalized);
			return true;
		}

		// Prefix match (do NOT pop; allow many descendants)
		for (const prefix of this.trackedPrefixes.keys()) {
			if (normalized === prefix || normalized.startsWith(prefix + "/")) {
				return true;
			}
		}

		return false;
	}

	private extractFolderPrefixes(action: VaultAction): string[] {
		switch (action.type) {
			case VaultActionType.CreateFolder:
			case VaultActionType.TrashFolder:
				return [
					systemPathFromSplitPathInternal(action.payload.splitPath),
				];

			case VaultActionType.RenameFolder:
				return [
					systemPathFromSplitPathInternal(action.payload.from),
					systemPathFromSplitPathInternal(action.payload.to),
				];

			default:
				return [];
		}
	}

	private trackPrefix(prefix: string): void {
		const normalized = this.normalizePath(prefix);

		const existing = this.trackedPrefixes.get(normalized);
		if (existing) clearTimeout(existing);

		const timeout = setTimeout(
			() => this.trackedPrefixes.delete(normalized),
			this.ttlMs,
		);
		this.trackedPrefixes.set(normalized, timeout);
	}

	private trackPath(path: string): void {
		const normalized = this.normalizePath(path);
		const existing = this.trackedPaths.get(normalized);
		if (existing) clearTimeout(existing);

		const timeout = setTimeout(
			() => this.trackedPaths.delete(normalized),
			this.ttlMs,
		);
		this.trackedPaths.set(normalized, timeout);
	}

	private untrackPath(normalized: string): void {
		const timeout = this.trackedPaths.get(normalized);
		if (timeout) clearTimeout(timeout);
		this.trackedPaths.delete(normalized);
	}

	private extractPaths(action: VaultAction): string[] {
		switch (action.type) {
			case VaultActionType.CreateFolder:
			case VaultActionType.CreateFile:
			case VaultActionType.UpsertMdFile:
			case VaultActionType.ProcessMdFile:
				return this.extractPathsWithParents(action.payload.splitPath);

			case VaultActionType.TrashFolder:
			case VaultActionType.TrashFile:
			case VaultActionType.TrashMdFile:
				return [
					systemPathFromSplitPathInternal(action.payload.splitPath),
				];

			case VaultActionType.RenameFolder:
			case VaultActionType.RenameFile:
			case VaultActionType.RenameMdFile:
				return [
					...this.extractPathsWithParents(action.payload.from),
					...this.extractPathsWithParents(action.payload.to),
				];

			default:
				return [];
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
	 * Normalize path for matching.
	 * Obsidian paths are already normalized, but we ensure consistency.
	 */
	private normalizePath(path: string): string {
		return path.replace(/^[\\/]+|[\\/]+$/g, "").replace(/\\/g, "/");
	}
}
