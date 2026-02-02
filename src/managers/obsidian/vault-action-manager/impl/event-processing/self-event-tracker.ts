import { pathfinder } from "../../helpers/pathfinder";
import type { AnySplitPath } from "../../types/split-path";
import type { VaultAction } from "../../types/vault-action";
import { VaultActionKind } from "../../types/vault-action";

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
 *
 * ## Note on Idempotency (Issue 10)
 *
 * As of the idempotent tree changes, tree.apply() now returns { changed, node }.
 * The healer skips healing when !changed, preventing infinite loops at the source.
 *
 * This means SelfEventTracker is now a **performance optimization** rather than
 * a correctness requirement. Even if self-events slip through, the idempotent
 * pipeline handles them safely (no healing generated for already-applied actions).
 *
 * Benefits of keeping SelfEventTracker:
 * - Avoids processing self-events entirely (better performance)
 * - Provides waitForObsidianEvents() for E2E test synchronization
 * - Cleaner event logs (only user-triggered events appear)
 */
export class SelfEventTracker {
	private readonly tracked = new Map<
		string,
		{
			timeout: ReturnType<typeof setTimeout>;
			isFilePath: boolean;
		}
	>();
	private readonly trackedPrefixes = new Map<
		string,
		ReturnType<typeof setTimeout>
	>();
	private readonly ttlMs = 5000;
	/** Waiters that resolve when all registered paths are popped */
	private readonly allRegisteredWaiters: Array<() => void> = [];

	register(actions: readonly VaultAction[]): void {
		for (const action of actions) {
			const paths = this.extractPaths(action);
			// Determine which file path should be queryable (if any)
			const filePathToVerify = this.getFilePathToVerify(action, paths);

			for (const path of paths) {
				const normalized = this.normalizePath(path);
				const isFilePath =
					filePathToVerify !== undefined &&
					normalized === this.normalizePath(filePathToVerify);
				this.trackPath(normalized, isFilePath);
			}
			for (const prefix of this.extractFolderPrefixes(action))
				this.trackPrefix(prefix);
		}
	}

	shouldIgnore(path: string): boolean {
		const normalized = this.normalizePath(path);

		// Exact match (pop-on-match)
		if (this.tracked.has(normalized)) {
			this.untrackPath(normalized);
			this.checkAllRegistered();
			return true;
		}

		// Prefix match (do NOT pop; allow many descendants)
		for (const prefix of this.trackedPrefixes.keys()) {
			if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
				return true;
			}
		}

		return false;
	}

	private extractFolderPrefixes(action: VaultAction): string[] {
		switch (action.kind) {
			// CreateFolder: Don't use prefix matching.
			// Obsidian only emits a single create event for the folder itself.
			// Using prefix matching incorrectly filters out user-created files inside.
			// The folder path is already tracked via extractPaths for exact matching.
			case VaultActionKind.CreateFolder:
				return [];

			case VaultActionKind.TrashFolder:
				// TrashFolder needs prefix matching to filter child file delete events
				return [
					pathfinder.systemPathFromSplitPath(action.payload.splitPath),
				];

			case VaultActionKind.RenameFolder:
				// Only track the source (from) folder as a prefix.
				// Obsidian emits rename events with oldPath under the source prefix.
				// Tracking the destination prefix would incorrectly filter out
				// user-created files in the renamed folder.
				return [pathfinder.systemPathFromSplitPath(action.payload.from)];

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

	private trackPath(normalized: string, isFilePath: boolean): void {
		const existing = this.tracked.get(normalized);
		if (existing) clearTimeout(existing.timeout);

		const timeout = setTimeout(() => {
			this.tracked.delete(normalized);
			this.checkAllRegistered();
		}, this.ttlMs);
		this.tracked.set(normalized, { isFilePath, timeout });
	}

	private untrackPath(normalized: string): void {
		const entry = this.tracked.get(normalized);
		if (entry) clearTimeout(entry.timeout);
		this.tracked.delete(normalized);
	}

	private extractPaths(action: VaultAction): string[] {
		switch (action.kind) {
			case VaultActionKind.CreateFolder:
				// For folder creation, track with parents (Obsidian may auto-create parent folders)
				return this.extractPathsWithParents(action.payload.splitPath);

			case VaultActionKind.CreateFile:
			case VaultActionKind.UpsertMdFile:
			case VaultActionKind.ProcessMdFile:
				// For file creation, only track the file itself, NOT parent folders.
				// Parent folders either already exist or are explicitly created via CreateFolder.
				// Tracking parent folders caused user folder operations to be incorrectly filtered.
				return [
					pathfinder.systemPathFromSplitPath(action.payload.splitPath),
				];

			case VaultActionKind.TrashFolder:
			case VaultActionKind.TrashFile:
			case VaultActionKind.TrashMdFile:
				return [
					pathfinder.systemPathFromSplitPath(action.payload.splitPath),
				];

			case VaultActionKind.RenameFolder:
				// For folder renames, track source with parents and just the destination folder
				return [
					...this.extractPathsWithParents(action.payload.from),
					pathfinder.systemPathFromSplitPath(action.payload.to),
				];

			case VaultActionKind.RenameFile:
			case VaultActionKind.RenameMdFile:
				// For file renames, only track the file paths themselves, NOT parent folders.
				// Reason: Parent folder paths from the source location were incorrectly
				// causing user folder rename events to be filtered out. The parent folders
				// either already exist (for in-place renames) or should be created via
				// explicit CreateFolder actions if they don't exist.
				return [
					pathfinder.systemPathFromSplitPath(action.payload.from),
					pathfinder.systemPathFromSplitPath(action.payload.to),
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
	private extractPathsWithParents(splitPath: AnySplitPath): string[] {
		const paths: string[] = [];

		// Extract all parent folder paths FIRST (Obsidian creates them before the target)
		// For pathParts ["a", "b", "c"], generate: "a", "a/b" (parents only, not target)
		const { pathParts } = splitPath;
		for (let i = 1; i < pathParts.length; i++) {
			const parentPathParts = pathParts.slice(0, i);
			const parentPath = pathfinder.pathToFolderFromPathParts(parentPathParts);
			if (parentPath) {
				paths.push(parentPath);
			}
		}

		// Then add the target path (file or folder being created)
		const targetPath = pathfinder.systemPathFromSplitPath(splitPath);
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

	/**
	 * Get file path that should be verified as queryable after action completes.
	 * Returns undefined for folders, trashes, or if no file path should exist.
	 */
	private getFilePathToVerify(
		action: VaultAction,
		paths: string[],
	): string | undefined {
		switch (action.kind) {
			case VaultActionKind.CreateFile:
			case VaultActionKind.UpsertMdFile:
			case VaultActionKind.ProcessMdFile:
				// Target file path is the last one (after parent folders)
				return paths[paths.length - 1];

			case VaultActionKind.RenameFile:
			case VaultActionKind.RenameMdFile: {
				// For renames, verify the "to" path (destination)
				// extractPaths for file renames returns: [from, to]
				// So the last path is the "to" target
				return paths[paths.length - 1];
			}

			case VaultActionKind.TrashFile:
			case VaultActionKind.TrashMdFile:
			case VaultActionKind.CreateFolder:
			case VaultActionKind.RenameFolder:
			case VaultActionKind.TrashFolder:
				// Don't verify folders or trashed files
				return undefined;
		}
	}

	/**
	 * Get all currently registered file paths (for verification).
	 * Should be called before waitForAllRegistered() to capture all files.
	 */
	getRegisteredFilePaths(): readonly string[] {
		return Array.from(this.tracked.entries())
			.filter(([, entry]) => entry.isFilePath)
			.map(([path]) => path);
	}

	/**
	 * Wait until all registered paths have been popped by Obsidian events.
	 * Returns immediately if no paths are registered.
	 */
	async waitForAllRegistered(): Promise<void> {
		if (this.tracked.size === 0) {
			return Promise.resolve();
		}
		await new Promise<void>((resolve) => {
			this.allRegisteredWaiters.push(() => resolve());
		});
	}

	/**
	 * Check if all registered paths have been popped, and resolve waiters if so.
	 */
	private checkAllRegistered(): void {
		if (this.tracked.size === 0 && this.allRegisteredWaiters.length > 0) {
			const waiters = [...this.allRegisteredWaiters];
			this.allRegisteredWaiters.length = 0;
			for (const resolve of waiters) {
				resolve();
			}
		}
	}
}
