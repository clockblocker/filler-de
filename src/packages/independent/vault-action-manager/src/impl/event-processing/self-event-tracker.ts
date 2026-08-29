import { Clock, Deferred, Effect, Ref } from "effect";
import { pathfinder } from "../../helpers/pathfinder";
import type { AnySplitPath } from "../../types/split-path";
import type { VaultAction } from "../../types/vault-action";
import { VaultActionKind } from "../../types/vault-action";

type ExactEntry = {
	readonly expiresAt: number;
	readonly isFilePath: boolean;
};

type SelfEventState = {
	readonly changed: Deferred.Deferred<void>;
	readonly prefixes: ReadonlyMap<string, number>;
	readonly tracked: ReadonlyMap<string, ExactEntry>;
};

type SelfEventTrackerCore = {
	readonly state: Ref.Ref<SelfEventState>;
};

export type SelfEventTrackerOptions = {
	readonly ttlMs?: number;
};

type PrunedState = {
	readonly changed: boolean;
	readonly prefixes: Map<string, number>;
	readonly tracked: Map<string, ExactEntry>;
};

type IgnoreUpdate = {
	readonly ignored: boolean;
	readonly previousSignal: Deferred.Deferred<void> | undefined;
};

type SnapshotUpdate = {
	readonly previousSignal: Deferred.Deferred<void> | undefined;
	readonly snapshot: SelfEventState;
};

function pruneState(state: SelfEventState, now: number): PrunedState {
	let changed = false;
	const tracked = new Map<string, ExactEntry>();
	for (const [path, entry] of state.tracked) {
		if (entry.expiresAt <= now) changed = true;
		else tracked.set(path, entry);
	}

	const prefixes = new Map<string, number>();
	for (const [prefix, expiresAt] of state.prefixes) {
		if (expiresAt <= now) changed = true;
		else prefixes.set(prefix, expiresAt);
	}

	return { changed, prefixes, tracked };
}

function nextState(
	tracked: ReadonlyMap<string, ExactEntry>,
	prefixes: ReadonlyMap<string, number>,
): SelfEventState {
	return {
		changed: Deferred.makeUnsafe<void>(),
		prefixes,
		tracked,
	};
}

const makeSelfEventTrackerCore = Effect.fn("makeSelfEventTrackerCore")(
	function* (): Effect.fn.Return<SelfEventTrackerCore> {
		const changed = yield* Deferred.make<void>();
		const state = yield* Ref.make<SelfEventState>({
			changed,
			prefixes: new Map(),
			tracked: new Map(),
		});
		return { state };
	},
);

/**
 * Tracks Self Events by normalized path with a Clock-driven expiration time.
 *
 * Exact entries pop on their first match. Folder prefixes remain available to
 * match every descendant event until their expiration timestamp.
 */
export class SelfEventTracker {
	private readonly core: SelfEventTrackerCore;
	private readonly ttlMs: number;

	private constructor(
		options: SelfEventTrackerOptions,
		core: SelfEventTrackerCore,
	) {
		this.ttlMs = options.ttlMs ?? 5000;
		this.core = core;
	}

	static readonly makeEffect = Effect.fn("SelfEventTracker.makeEffect")(
		function* (
			options: SelfEventTrackerOptions = {},
		): Effect.fn.Return<SelfEventTracker> {
			const core = yield* makeSelfEventTrackerCore();
			return new SelfEventTracker(options, core);
		},
	);

	readonly registerEffect = Effect.fn("SelfEventTracker.register")(function* (
		this: SelfEventTracker,
		actions: readonly VaultAction[],
	): Effect.fn.Return<void> {
		const now = yield* Clock.currentTimeMillis;
		const expiration = now + this.ttlMs;
		const previousSignal = yield* Ref.modify(this.core.state, (state) => {
			const pruned = pruneState(state, now);

			for (const action of actions) {
				const paths = this.extractPaths(action);
				const filePathToVerify = this.getFilePathToVerify(
					action,
					paths,
				);
				const normalizedFilePath =
					filePathToVerify === undefined
						? undefined
						: this.normalizePath(filePathToVerify);

				for (const path of paths) {
					const normalized = this.normalizePath(path);
					pruned.tracked.set(normalized, {
						expiresAt: expiration,
						isFilePath: normalized === normalizedFilePath,
					});
				}

				for (const prefix of this.extractFolderPrefixes(action)) {
					pruned.prefixes.set(this.normalizePath(prefix), expiration);
				}
			}

			return [state.changed, nextState(pruned.tracked, pruned.prefixes)];
		});
		yield* Deferred.succeed(previousSignal, undefined);
	});

	readonly shouldIgnoreEffect = Effect.fn("SelfEventTracker.shouldIgnore")(
		function* (
			this: SelfEventTracker,
			path: string,
		): Effect.fn.Return<boolean> {
			const now = yield* Clock.currentTimeMillis;
			const normalized = this.normalizePath(path);
			const update = yield* Ref.modify(
				this.core.state,
				(state): readonly [IgnoreUpdate, SelfEventState] => {
					const pruned = pruneState(state, now);
					let ignored = false;
					let stateChanged = pruned.changed;

					if (pruned.tracked.has(normalized)) {
						pruned.tracked.delete(normalized);
						ignored = true;
						stateChanged = true;
					} else {
						for (const prefix of pruned.prefixes.keys()) {
							if (
								normalized === prefix ||
								normalized.startsWith(`${prefix}/`)
							) {
								ignored = true;
								break;
							}
						}
					}

					if (!stateChanged) {
						return [{ ignored, previousSignal: undefined }, state];
					}

					return [
						{ ignored, previousSignal: state.changed },
						nextState(pruned.tracked, pruned.prefixes),
					];
				},
			);

			if (update.previousSignal) {
				yield* Deferred.succeed(update.previousSignal, undefined);
			}
			return update.ignored;
		},
	);

	readonly getRegisteredFilePathsEffect = Effect.fn(
		"SelfEventTracker.getRegisteredFilePaths",
	)(function* (this: SelfEventTracker): Effect.fn.Return<readonly string[]> {
		const snapshot = yield* this.snapshotEffect();
		return [...snapshot.tracked.entries()]
			.filter(([, entry]) => entry.isFilePath)
			.map(([path]) => path);
	});

	readonly waitForAllRegisteredEffect = Effect.fn(
		"SelfEventTracker.waitForAllRegistered",
	)(function* (this: SelfEventTracker): Effect.fn.Return<void> {
		while (true) {
			const snapshot = yield* this.snapshotEffect();
			if (snapshot.tracked.size === 0) return;

			const now = yield* Clock.currentTimeMillis;
			let nearestExpiration = Number.POSITIVE_INFINITY;
			for (const entry of snapshot.tracked.values()) {
				nearestExpiration = Math.min(
					nearestExpiration,
					entry.expiresAt,
				);
			}

			yield* Effect.raceFirst(
				Deferred.await(snapshot.changed),
				Effect.sleep(Math.max(0, nearestExpiration - now)),
			);
		}
	});

	private readonly snapshotEffect = Effect.fn("SelfEventTracker.snapshot")(
		function* (this: SelfEventTracker): Effect.fn.Return<SelfEventState> {
			const now = yield* Clock.currentTimeMillis;
			const update = yield* Ref.modify(
				this.core.state,
				(state): readonly [SnapshotUpdate, SelfEventState] => {
					const pruned = pruneState(state, now);
					if (!pruned.changed) {
						return [
							{ previousSignal: undefined, snapshot: state },
							state,
						];
					}

					const snapshot = nextState(pruned.tracked, pruned.prefixes);
					return [
						{ previousSignal: state.changed, snapshot },
						snapshot,
					];
				},
			);

			if (update.previousSignal) {
				yield* Deferred.succeed(update.previousSignal, undefined);
			}
			return update.snapshot;
		},
	);

	private extractFolderPrefixes(action: VaultAction): string[] {
		switch (action.kind) {
			case VaultActionKind.TrashFolder:
				return [
					pathfinder.systemPathFromSplitPath(
						action.payload.splitPath,
					),
				];
			case VaultActionKind.RenameFolder:
				return [
					pathfinder.systemPathFromSplitPath(action.payload.from),
				];
			default:
				return [];
		}
	}

	private extractPaths(action: VaultAction): string[] {
		switch (action.kind) {
			case VaultActionKind.CreateFolder:
				return this.extractPathsWithParents(action.payload.splitPath);

			case VaultActionKind.CreateFile:
			case VaultActionKind.UpsertMdFile:
				return [
					pathfinder.systemPathFromSplitPath(
						action.payload.splitPath,
					),
				];

			case VaultActionKind.ProcessMdFile:
				return [];

			case VaultActionKind.TrashFolder:
			case VaultActionKind.TrashFile:
			case VaultActionKind.TrashMdFile:
				return [
					pathfinder.systemPathFromSplitPath(
						action.payload.splitPath,
					),
				];

			case VaultActionKind.RenameFolder:
				return [
					...this.extractPathsWithParents(action.payload.from),
					pathfinder.systemPathFromSplitPath(action.payload.to),
				];

			case VaultActionKind.RenameFile:
			case VaultActionKind.RenameMdFile:
				return [
					pathfinder.systemPathFromSplitPath(action.payload.from),
					pathfinder.systemPathFromSplitPath(action.payload.to),
				];
		}
	}

	private extractPathsWithParents(splitPath: AnySplitPath): string[] {
		const paths: string[] = [];
		const { pathParts } = splitPath;
		for (let i = 1; i < pathParts.length; i++) {
			const parentPath = pathfinder.pathToFolderFromPathParts(
				pathParts.slice(0, i),
			);
			if (parentPath) paths.push(parentPath);
		}
		paths.push(pathfinder.systemPathFromSplitPath(splitPath));
		return paths;
	}

	private normalizePath(path: string): string {
		return path.replace(/^[\\/]+|[\\/]+$/g, "").replace(/\\/g, "/");
	}

	private getFilePathToVerify(
		action: VaultAction,
		paths: string[],
	): string | undefined {
		switch (action.kind) {
			case VaultActionKind.CreateFile:
			case VaultActionKind.UpsertMdFile:
			case VaultActionKind.RenameFile:
			case VaultActionKind.RenameMdFile:
				return paths.at(-1);

			case VaultActionKind.ProcessMdFile:
			case VaultActionKind.TrashFile:
			case VaultActionKind.TrashMdFile:
			case VaultActionKind.CreateFolder:
			case VaultActionKind.RenameFolder:
			case VaultActionKind.TrashFolder:
				return undefined;
		}
	}
}
