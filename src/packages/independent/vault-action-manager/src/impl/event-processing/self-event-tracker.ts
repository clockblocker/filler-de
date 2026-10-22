import { Clock, Deferred, Effect, Ref } from "effect";
import { pathfinder } from "../../helpers/pathfinder";
import type { AnySplitPath } from "../../types/split-path";
import type { VaultAction } from "../../types/vault-action";
import { VaultActionKind } from "../../types/vault-action";
import { VaultPath } from "../../vault-path";

type ExactEntry = {
	readonly expiresAt: number;
	readonly isFilePath: boolean;
};

/**
 * A folder rename VAM is running or ran. Obsidian reports a rename for each
 * descendant of the moved folder, and each such pair is Self.
 */
type FolderRenameEntry = {
	readonly expiresAt: number;
	readonly from: string;
	readonly to: string;
};

type SelfEventState = {
	readonly changed: Deferred.Deferred<void>;
	/** Keyed by `folderRenameKey(from, to)`. */
	readonly folderRenames: ReadonlyMap<string, FolderRenameEntry>;
	/**
	 * Expected Obsidian modify callbacks, one expiration per VAM write. This
	 * namespace is separate from create, rename, and delete attribution and
	 * does not hold the settle barrier open.
	 */
	readonly modifies: ReadonlyMap<string, readonly number[]>;
	readonly prefixes: ReadonlyMap<string, number>;
	/**
	 * Renames that landed elsewhere than planned, keyed by
	 * `folderRenameKey(from, plannedTo)`: the path VAM actually moved the
	 * source to. Their window closes when the planned action finishes.
	 */
	readonly redirects: ReadonlyMap<string, string>;
	readonly tracked: ReadonlyMap<string, ExactEntry>;
};

/** A rename VAM is about to run to another destination than its action names. */
export type RenameRedirect = {
	readonly from: string;
	/** The action's `to`. */
	readonly planned: string;
	/** Where VAM moves the source instead, such as a free indexed name. */
	readonly actual: string;
	readonly isFolder: boolean;
};

type SelfEventTrackerCore = {
	readonly state: Ref.Ref<SelfEventState>;
};

type SelfEventTrackerOptions = {
	readonly ttlMs?: number;
};

type PrunedState = {
	readonly changed: boolean;
	readonly folderRenames: Map<string, FolderRenameEntry>;
	readonly prefixes: Map<string, number>;
	readonly tracked: Map<string, ExactEntry>;
};

type ModifyUpdate<A> = {
	readonly previousSignal: Deferred.Deferred<void> | undefined;
	readonly result: A;
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

	const folderRenames = new Map<string, FolderRenameEntry>();
	for (const [key, entry] of state.folderRenames) {
		if (entry.expiresAt <= now) changed = true;
		else folderRenames.set(key, entry);
	}

	return { changed, folderRenames, prefixes, tracked };
}

function nextState(
	previous: SelfEventState,
	pruned: PrunedState,
): SelfEventState {
	return {
		changed: Deferred.makeUnsafe<void>(),
		folderRenames: pruned.folderRenames,
		modifies: previous.modifies,
		prefixes: pruned.prefixes,
		redirects: previous.redirects,
		tracked: pruned.tracked,
	};
}

function folderRenameKey(from: string, to: string): string {
	return JSON.stringify([from, to]);
}

/**
 * Pops `normalized` if it is an exact entry, else matches it against the
 * folder prefixes. The vault root (`""`) as a prefix matches only itself.
 */
function matchPath(
	pruned: PrunedState,
	normalized: string,
): { readonly ignored: boolean; readonly popped: boolean } {
	if (pruned.tracked.delete(normalized)) {
		return { ignored: true, popped: true };
	}
	for (const prefix of pruned.prefixes.keys()) {
		if (coveredByPrefix(normalized, prefix)) {
			return { ignored: true, popped: false };
		}
	}
	return { ignored: false, popped: false };
}

/**
 * Whether `path` is the folder `prefix` or lies below it. Nothing lies under
 * the vault root (`""`) here: a root prefix covers only the root itself.
 */
function coveredByPrefix(path: string, prefix: string): boolean {
	return prefix === VaultPath.root
		? path === prefix
		: VaultPath.caseSensitive.isUnder(path, prefix, { inclusive: true });
}

/**
 * True when `oldPath -> newPath` is the rename Obsidian reports for a
 * descendant of a folder VAM renamed: `oldPath` lies strictly under the
 * source and `newPath` is the same remainder under the destination. The
 * folder's own rename is left to its exact entries. Nothing lies under the
 * vault root (`""`), matching how folder prefixes treat it.
 */
function isFolderRenameDescendant(
	folderRenames: ReadonlyMap<string, FolderRenameEntry>,
	oldPath: string,
	newPath: string,
): boolean {
	for (const { from, to } of folderRenames.values()) {
		if (
			from === VaultPath.root ||
			!VaultPath.caseSensitive.isUnder(oldPath, from, {
				inclusive: false,
			})
		)
			continue;
		const remainder = oldPath.slice(from.length + 1);
		if (
			VaultPath.caseSensitive.same(newPath, VaultPath.join(to, remainder))
		) {
			return true;
		}
	}
	return false;
}

function pruneModifies(
	modifies: ReadonlyMap<string, readonly number[]>,
	now: number,
): Map<string, readonly number[]> {
	const pruned = new Map<string, readonly number[]>();
	for (const [path, expirations] of modifies) {
		const live = expirations.filter((expiresAt) => expiresAt > now);
		if (live.length > 0) pruned.set(path, live);
	}
	return pruned;
}

const makeSelfEventTrackerCore = Effect.fn("makeSelfEventTrackerCore")(
	function* (): Effect.fn.Return<SelfEventTrackerCore> {
		const changed = yield* Deferred.make<void>();
		const state = yield* Ref.make<SelfEventState>({
			changed,
			folderRenames: new Map(),
			modifies: new Map(),
			prefixes: new Map(),
			redirects: new Map(),
			tracked: new Map(),
		});
		return { state };
	},
);

/**
 * Tracks Self Events by normalized path with a Clock-driven expiration time.
 *
 * The Dispatch Batch worker begins each action's window immediately before
 * the action runs and finishes it when the action ends, so the window lasts
 * while the action runs plus one TTL, however long the batch is.
 *
 * Exact entries pop on their first match. Folder prefixes remain available to
 * match every descendant event until their expiration timestamp. A folder
 * rename also matches, until it expires, each descendant rename that moves a
 * path from under its source to the same place under its destination; other
 * events in the destination stay observable. Modify
 * expectations are counted per path and recorded at write time, because only
 * the executor knows whether a write actually happens.
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

	/** Registers `actions` with a window of one TTL from now. */
	readonly registerEffect = Effect.fn("SelfEventTracker.register")(function* (
		this: SelfEventTracker,
		actions: readonly VaultAction[],
	): Effect.fn.Return<void> {
		const now = yield* Clock.currentTimeMillis;
		yield* this.registerUntil(actions, now + this.ttlMs);
	});

	private readonly registerUntil = Effect.fnUntraced(function* (
		this: SelfEventTracker,
		actions: readonly VaultAction[],
		expiration: number,
	): Effect.fn.Return<void> {
		const now = yield* Clock.currentTimeMillis;
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

				const folderRename = this.extractFolderRename(action);
				if (folderRename !== undefined) {
					pruned.folderRenames.set(
						folderRenameKey(folderRename.from, folderRename.to),
						{ ...folderRename, expiresAt: expiration },
					);
				}
			}

			return [state.changed, nextState(state, pruned)];
		});
		yield* Deferred.succeed(previousSignal, undefined);
	});

	/**
	 * Opens the Self Event window of an action that is about to run. Its
	 * entries do not expire while it runs; `finishEffect` starts their TTL.
	 */
	readonly beginEffect = Effect.fn("SelfEventTracker.begin")(function* (
		this: SelfEventTracker,
		action: VaultAction,
	): Effect.fn.Return<void> {
		yield* this.registerUntil([action], Number.POSITIVE_INFINITY);
	});

	/**
	 * Starts the TTL of a begun action's still-unmatched entries now, so an
	 * event Obsidian reports during or shortly after a slow action is still
	 * Self. Entries already matched stay matched.
	 */
	readonly finishEffect = Effect.fn("SelfEventTracker.finish")(function* (
		this: SelfEventTracker,
		action: VaultAction,
	): Effect.fn.Return<void> {
		const now = yield* Clock.currentTimeMillis;
		const expiration = now + this.ttlMs;
		const previousSignal = yield* Ref.modify(
			this.core.state,
			(state): readonly [Deferred.Deferred<void>, SelfEventState] => {
				const pruned = pruneState(state, now);

				for (const path of this.extractPaths(action)) {
					const normalized = this.normalizePath(path);
					const entry = pruned.tracked.get(normalized);
					if (entry === undefined) continue;
					pruned.tracked.set(normalized, {
						...entry,
						expiresAt: expiration,
					});
				}

				for (const prefix of this.extractFolderPrefixes(action)) {
					const normalized = this.normalizePath(prefix);
					if (pruned.prefixes.has(normalized)) {
						pruned.prefixes.set(normalized, expiration);
					}
				}

				const folderRename = this.extractFolderRename(action);
				if (folderRename !== undefined) {
					const key = folderRenameKey(
						folderRename.from,
						folderRename.to,
					);
					const entry = pruned.folderRenames.get(key);
					if (entry !== undefined) {
						pruned.folderRenames.set(key, {
							...entry,
							expiresAt: expiration,
						});
					}
				}

				// A rename that landed elsewhere closes its entries there too.
				const rename = this.extractRename(action);
				const redirectKey =
					rename && folderRenameKey(rename.from, rename.to);
				const actual = redirectKey && state.redirects.get(redirectKey);
				if (!rename || !redirectKey || actual === undefined)
					return [state.changed, nextState(state, pruned)];

				const entry = pruned.tracked.get(actual);
				if (entry !== undefined)
					pruned.tracked.set(actual, {
						...entry,
						expiresAt: expiration,
					});
				const actualKey = folderRenameKey(rename.from, actual);
				const redirected = pruned.folderRenames.get(actualKey);
				if (redirected !== undefined)
					pruned.folderRenames.set(actualKey, {
						...redirected,
						expiresAt: expiration,
					});
				const redirects = new Map(state.redirects);
				redirects.delete(redirectKey);
				return [
					state.changed,
					{ ...nextState(state, pruned), redirects },
				];
			},
		);
		yield* Deferred.succeed(previousSignal, undefined);
	});

	/**
	 * Records, immediately before VAM moves a source elsewhere than its
	 * action's `to`, where it moves it, so the callbacks Obsidian reports for
	 * that move are Self (#175). A folder's descendant renames then match the
	 * actual destination by the remainder rule. The entries share the
	 * planned action's window and close when it finishes; the planned
	 * destination's entries go, since nothing lands there.
	 */
	readonly expectRenameDestinationEffect = Effect.fn(
		"vam.selfEvents.expectRenameDestination",
	)(function* (
		this: SelfEventTracker,
		redirect: RenameRedirect,
	): Effect.fn.Return<void> {
		const now = yield* Clock.currentTimeMillis;
		const from = this.normalizePath(redirect.from);
		const planned = this.normalizePath(redirect.planned);
		const actual = this.normalizePath(redirect.actual);
		const plannedKey = folderRenameKey(from, planned);
		const previousSignal = yield* Ref.modify(
			this.core.state,
			(state): readonly [Deferred.Deferred<void>, SelfEventState] => {
				const pruned = pruneState(state, now);
				const window =
					(redirect.isFolder
						? pruned.folderRenames.get(plannedKey)?.expiresAt
						: pruned.tracked.get(planned)?.expiresAt) ??
					now + this.ttlMs;
				// Nothing lands at the planned destination now: its entries
				// would only hide a user's event there, and hold the settle
				// barrier until they expire.
				pruned.tracked.delete(planned);
				pruned.folderRenames.delete(plannedKey);
				pruned.tracked.set(actual, {
					expiresAt: window,
					isFilePath: !redirect.isFolder,
				});
				if (redirect.isFolder)
					pruned.folderRenames.set(folderRenameKey(from, actual), {
						expiresAt: window,
						from,
						to: actual,
					});
				const redirects = new Map(state.redirects);
				redirects.set(plannedKey, actual);
				return [
					state.changed,
					{ ...nextState(state, pruned), redirects },
				];
			},
		);
		yield* Deferred.succeed(previousSignal, undefined);
	});

	readonly shouldIgnoreEffect = Effect.fn("SelfEventTracker.shouldIgnore")(
		function* (
			this: SelfEventTracker,
			path: string,
		): Effect.fn.Return<boolean> {
			const normalized = this.normalizePath(path);
			return yield* this.modifyPrunedEffect((pruned) => {
				const match = matchPath(pruned, normalized);
				return [match.ignored, match.popped];
			});
		},
	);

	/**
	 * Attributes one Obsidian rename callback. It is Self when both paths
	 * are expected, or when it is a descendant rename of a folder VAM
	 * renamed.
	 */
	readonly shouldIgnoreRenameEffect = Effect.fn(
		"SelfEventTracker.shouldIgnoreRename",
	)(function* (
		this: SelfEventTracker,
		oldPath: string,
		newPath: string,
	): Effect.fn.Return<boolean> {
		const normalizedOld = this.normalizePath(oldPath);
		const normalizedNew = this.normalizePath(newPath);
		return yield* this.modifyPrunedEffect((pruned) => {
			if (
				isFolderRenameDescendant(
					pruned.folderRenames,
					normalizedOld,
					normalizedNew,
				)
			) {
				return [true, false];
			}
			const newMatch = matchPath(pruned, normalizedNew);
			const oldMatch = matchPath(pruned, normalizedOld);
			return [
				newMatch.ignored && oldMatch.ignored,
				newMatch.popped || oldMatch.popped,
			];
		});
	});

	/**
	 * Runs `f` on the pruned state. `f` returns its result and whether it
	 * changed the state; any change, pruning included, signals waiters.
	 */
	private readonly modifyPrunedEffect = Effect.fnUntraced(function* <A>(
		this: SelfEventTracker,
		f: (pruned: PrunedState) => readonly [A, boolean],
	): Effect.fn.Return<A> {
		const now = yield* Clock.currentTimeMillis;
		const update = yield* Ref.modify(
			this.core.state,
			(state): readonly [ModifyUpdate<A>, SelfEventState] => {
				const pruned = pruneState(state, now);
				const [result, changed] = f(pruned);
				if (!pruned.changed && !changed) {
					return [{ previousSignal: undefined, result }, state];
				}
				return [
					{ previousSignal: state.changed, result },
					nextState(state, pruned),
				];
			},
		);

		if (update.previousSignal) {
			yield* Deferred.succeed(update.previousSignal, undefined);
		}
		return update.result;
	});

	/**
	 * Records that VAM is about to write `path` through the vault, so the
	 * resulting modify callback is attributed as a Self Event. Call it only
	 * immediately before a write that will happen.
	 */
	readonly expectModifyEffect = Effect.fn("SelfEventTracker.expectModify")(
		function* (
			this: SelfEventTracker,
			path: string,
		): Effect.fn.Return<void> {
			const now = yield* Clock.currentTimeMillis;
			const normalized = this.normalizePath(path);
			yield* Ref.update(this.core.state, (state) => {
				const modifies = pruneModifies(state.modifies, now);
				modifies.set(normalized, [
					...(modifies.get(normalized) ?? []),
					now + this.ttlMs,
				]);
				return { ...state, modifies };
			});
		},
	);

	/** Withdraws the newest expectation for `path` after a failed write. */
	readonly forgetModifyEffect = Effect.fn("SelfEventTracker.forgetModify")(
		function* (
			this: SelfEventTracker,
			path: string,
		): Effect.fn.Return<void> {
			const now = yield* Clock.currentTimeMillis;
			const normalized = this.normalizePath(path);
			yield* Ref.update(this.core.state, (state) => {
				const modifies = pruneModifies(state.modifies, now);
				const remaining = (modifies.get(normalized) ?? []).slice(0, -1);
				if (remaining.length > 0) modifies.set(normalized, remaining);
				else modifies.delete(normalized);
				return { ...state, modifies };
			});
		},
	);

	/**
	 * Drops every modify expectation. Writes made while nobody listened for
	 * modify callbacks leave expectations whose callbacks already fired; a
	 * new listener must not let them hide the next real edit.
	 */
	readonly clearModifiesEffect = Effect.fn("SelfEventTracker.clearModifies")(
		function* (this: SelfEventTracker): Effect.fn.Return<void> {
			yield* Ref.update(this.core.state, (state) => ({
				...state,
				modifies: new Map(),
			}));
		},
	);

	/** Pops one live modify expectation for `path`, if VAM wrote it. */
	readonly shouldIgnoreModifyEffect = Effect.fn(
		"SelfEventTracker.shouldIgnoreModify",
	)(function* (
		this: SelfEventTracker,
		path: string,
	): Effect.fn.Return<boolean> {
		const now = yield* Clock.currentTimeMillis;
		const normalized = this.normalizePath(path);
		return yield* Ref.modify(
			this.core.state,
			(state): readonly [boolean, SelfEventState] => {
				const modifies = pruneModifies(state.modifies, now);
				const [, ...remaining] = modifies.get(normalized) ?? [];
				const ignored = modifies.has(normalized);
				if (remaining.length > 0) modifies.set(normalized, remaining);
				else modifies.delete(normalized);
				return [ignored, { ...state, modifies }];
			},
		);
	});

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

					const snapshot = nextState(state, pruned);
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

	private extractFolderRename(
		action: VaultAction,
	): { readonly from: string; readonly to: string } | undefined {
		if (action.kind !== VaultActionKind.RenameFolder) return undefined;
		return {
			from: this.normalizePath(
				pathfinder.systemPathFromSplitPath(action.payload.from),
			),
			to: this.normalizePath(
				pathfinder.systemPathFromSplitPath(action.payload.to),
			),
		};
	}

	/** A rename's normalized ends, of a file or a folder. */
	private extractRename(
		action: VaultAction,
	): { readonly from: string; readonly to: string } | undefined {
		switch (action.kind) {
			case VaultActionKind.RenameFolder:
			case VaultActionKind.RenameFile:
			case VaultActionKind.RenameMdFile:
				return {
					from: this.normalizePath(
						pathfinder.systemPathFromSplitPath(action.payload.from),
					),
					to: this.normalizePath(
						pathfinder.systemPathFromSplitPath(action.payload.to),
					),
				};
			default:
				return undefined;
		}
	}

	private extractPaths(action: VaultAction): string[] {
		switch (action.kind) {
			case VaultActionKind.CreateFolder:
				return this.extractPathsWithParents(action.payload.splitPath);

			case VaultActionKind.CreateFile:
			case VaultActionKind.CreateMdFile:
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

	/**
	 * Case-sensitive, as Obsidian reports a path: a rename that changes only
	 * case expects both of its ends.
	 */
	private normalizePath(path: string): string {
		return VaultPath.caseSensitive.key(path);
	}

	private getFilePathToVerify(
		action: VaultAction,
		paths: string[],
	): string | undefined {
		switch (action.kind) {
			case VaultActionKind.CreateFile:
			case VaultActionKind.CreateMdFile:
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
