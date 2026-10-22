import { Clock, Deferred, Effect, Ref } from "effect";
import { CurrentVamOperation } from "../../effect/current-operation";
import { pathfinder } from "../../helpers/pathfinder";
import {
	EXTERNAL_ORIGIN,
	type VamOperation,
	type VaultEventOrigin,
	vamOrigin,
} from "../../types/event-origin";
import type { AnySplitPath } from "../../types/split-path";
import type { VaultAction } from "../../types/vault-action";
import { VaultActionKind } from "../../types/vault-action";
import { VaultPath } from "../../vault-path";

type ExactEntry = {
	readonly expiresAt: number;
	readonly isFilePath: boolean;
	/** The Dispatch Batch whose action expects the path. */
	readonly operation: VamOperation;
};

type PrefixEntry = {
	readonly expiresAt: number;
	readonly operation: VamOperation;
};

/** One expected modify callback of a VAM write. */
type ModifyEntry = {
	readonly expiresAt: number;
	readonly operation: VamOperation;
};

/**
 * A folder rename VAM is running or ran. Obsidian reports a rename for each
 * descendant of the moved folder, and each such pair is Self.
 */
type FolderRenameEntry = {
	readonly expiresAt: number;
	readonly from: string;
	readonly operation: VamOperation;
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
	readonly modifies: ReadonlyMap<string, readonly ModifyEntry[]>;
	readonly prefixes: ReadonlyMap<string, PrefixEntry>;
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
	readonly prefixes: Map<string, PrefixEntry>;
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

	const prefixes = new Map<string, PrefixEntry>();
	for (const [prefix, entry] of state.prefixes) {
		if (entry.expiresAt <= now) changed = true;
		else prefixes.set(prefix, entry);
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
 * folder prefixes, and answers the batch that expected it. The vault root
 * (`""`) as a prefix matches only itself.
 */
function matchPath(
	pruned: PrunedState,
	normalized: string,
): {
	readonly operation: VamOperation | undefined;
	readonly popped: boolean;
} {
	const exact = pruned.tracked.get(normalized);
	if (exact !== undefined) {
		pruned.tracked.delete(normalized);
		return { operation: exact.operation, popped: true };
	}
	for (const [prefix, entry] of pruned.prefixes) {
		if (coveredByPrefix(normalized, prefix)) {
			return { operation: entry.operation, popped: false };
		}
	}
	return { operation: undefined, popped: false };
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
 * The batch of the folder rename whose descendant `oldPath -> newPath` is:
 * `oldPath` lies strictly under its source and `newPath` is the same
 * remainder under its destination. The folder's own rename is left to its
 * exact entries. Nothing lies under the vault root (`""`), matching how
 * folder prefixes treat it.
 */
function folderRenameDescendantOf(
	folderRenames: ReadonlyMap<string, FolderRenameEntry>,
	oldPath: string,
	newPath: string,
): VamOperation | undefined {
	for (const { from, operation, to } of folderRenames.values()) {
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
			return operation;
		}
	}
	return undefined;
}

function originOf(operation: VamOperation | undefined): VaultEventOrigin {
	return operation === undefined ? EXTERNAL_ORIGIN : vamOrigin(operation);
}

function pruneModifies(
	modifies: ReadonlyMap<string, readonly ModifyEntry[]>,
	now: number,
): Map<string, readonly ModifyEntry[]> {
	const pruned = new Map<string, readonly ModifyEntry[]>();
	for (const [path, entries] of modifies) {
		const live = entries.filter(({ expiresAt }) => expiresAt > now);
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
 * Tracks Self Events by normalized path with a Clock-driven expiration time,
 * and attributes each vault callback to the Dispatch Batch that expected it.
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

	/** Registers `actions` of `operation` with a window of one TTL from now. */
	readonly registerEffect = Effect.fn("SelfEventTracker.register")(function* (
		this: SelfEventTracker,
		actions: readonly VaultAction[],
		operation: VamOperation,
	): Effect.fn.Return<void> {
		const now = yield* Clock.currentTimeMillis;
		yield* this.registerUntil(actions, now + this.ttlMs, operation);
	});

	private readonly registerUntil = Effect.fnUntraced(function* (
		this: SelfEventTracker,
		actions: readonly VaultAction[],
		expiration: number,
		operation: VamOperation,
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
						operation,
					});
				}

				for (const prefix of this.extractFolderPrefixes(action)) {
					pruned.prefixes.set(this.normalizePath(prefix), {
						expiresAt: expiration,
						operation,
					});
				}

				const folderRename = this.extractFolderRename(action);
				if (folderRename !== undefined) {
					pruned.folderRenames.set(
						folderRenameKey(folderRename.from, folderRename.to),
						{ ...folderRename, expiresAt: expiration, operation },
					);
				}
			}

			return [state.changed, nextState(state, pruned)];
		});
		yield* Deferred.succeed(previousSignal, undefined);
	});

	/**
	 * Opens the Self Event window of an action of `operation` that is about
	 * to run. Its entries do not expire while it runs; `finishEffect` starts
	 * their TTL.
	 */
	readonly beginEffect = Effect.fn("SelfEventTracker.begin")(function* (
		this: SelfEventTracker,
		action: VaultAction,
		operation: VamOperation,
	): Effect.fn.Return<void> {
		yield* this.registerUntil(
			[action],
			Number.POSITIVE_INFINITY,
			operation,
		);
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
					const entry = pruned.prefixes.get(normalized);
					if (entry !== undefined) {
						pruned.prefixes.set(normalized, {
							...entry,
							expiresAt: expiration,
						});
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
		const current = yield* CurrentVamOperation;
		const from = this.normalizePath(redirect.from);
		const planned = this.normalizePath(redirect.planned);
		const actual = this.normalizePath(redirect.actual);
		const plannedKey = folderRenameKey(from, planned);
		const previousSignal = yield* Ref.modify(
			this.core.state,
			(state): readonly [Deferred.Deferred<void>, SelfEventState] => {
				const pruned = pruneState(state, now);
				const plannedEntry = redirect.isFolder
					? pruned.folderRenames.get(plannedKey)
					: pruned.tracked.get(planned);
				const window = plannedEntry?.expiresAt ?? now + this.ttlMs;
				const operation = plannedEntry?.operation ?? current;
				// Nothing lands at the planned destination now: its entries
				// would only hide a user's event there, and hold the settle
				// barrier until they expire.
				pruned.tracked.delete(planned);
				pruned.folderRenames.delete(plannedKey);
				pruned.tracked.set(actual, {
					expiresAt: window,
					isFilePath: !redirect.isFolder,
					operation,
				});
				if (redirect.isFolder)
					pruned.folderRenames.set(folderRenameKey(from, actual), {
						expiresAt: window,
						from,
						operation,
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

	/**
	 * Attributes one Obsidian create or delete callback: `Vam`, with the
	 * batch that expected the path, or `External`.
	 */
	readonly attributeEffect = Effect.fn("SelfEventTracker.attribute")(
		function* (
			this: SelfEventTracker,
			path: string,
		): Effect.fn.Return<VaultEventOrigin> {
			const normalized = this.normalizePath(path);
			return yield* this.modifyPrunedEffect((pruned) => {
				const match = matchPath(pruned, normalized);
				return [originOf(match.operation), match.popped];
			});
		},
	);

	/**
	 * Attributes one Obsidian rename callback. It is VAM's when both paths
	 * are expected, under the batch that expected the new one, or when it
	 * is a descendant rename of a folder VAM renamed.
	 */
	readonly attributeRenameEffect = Effect.fn(
		"SelfEventTracker.attributeRename",
	)(function* (
		this: SelfEventTracker,
		oldPath: string,
		newPath: string,
	): Effect.fn.Return<VaultEventOrigin> {
		const normalizedOld = this.normalizePath(oldPath);
		const normalizedNew = this.normalizePath(newPath);
		return yield* this.modifyPrunedEffect((pruned) => {
			const descendantOf = folderRenameDescendantOf(
				pruned.folderRenames,
				normalizedOld,
				normalizedNew,
			);
			if (descendantOf !== undefined) {
				return [vamOrigin(descendantOf), false];
			}
			const newMatch = matchPath(pruned, normalizedNew);
			const oldMatch = matchPath(pruned, normalizedOld);
			return [
				originOf(
					oldMatch.operation === undefined
						? undefined
						: newMatch.operation,
				),
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
	 * resulting modify callback is attributed as a Self Event of the
	 * current Dispatch Batch. Call it only immediately before a write that
	 * will happen.
	 */
	readonly expectModifyEffect = Effect.fn("SelfEventTracker.expectModify")(
		function* (
			this: SelfEventTracker,
			path: string,
		): Effect.fn.Return<void> {
			const now = yield* Clock.currentTimeMillis;
			const operation = yield* CurrentVamOperation;
			const normalized = this.normalizePath(path);
			yield* Ref.update(this.core.state, (state) => {
				const modifies = pruneModifies(state.modifies, now);
				modifies.set(normalized, [
					...(modifies.get(normalized) ?? []),
					{ expiresAt: now + this.ttlMs, operation },
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

	/**
	 * Attributes one modify callback: pops the oldest live expectation for
	 * `path` and answers its batch, or `External` when VAM did not write it.
	 */
	readonly attributeModifyEffect = Effect.fn(
		"SelfEventTracker.attributeModify",
	)(function* (
		this: SelfEventTracker,
		path: string,
	): Effect.fn.Return<VaultEventOrigin> {
		const now = yield* Clock.currentTimeMillis;
		const normalized = this.normalizePath(path);
		return yield* Ref.modify(
			this.core.state,
			(state): readonly [VaultEventOrigin, SelfEventState] => {
				const modifies = pruneModifies(state.modifies, now);
				const [first, ...remaining] = modifies.get(normalized) ?? [];
				if (remaining.length > 0) modifies.set(normalized, remaining);
				else modifies.delete(normalized);
				return [originOf(first?.operation), { ...state, modifies }];
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
