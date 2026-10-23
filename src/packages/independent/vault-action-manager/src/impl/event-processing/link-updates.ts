import { Clock, Effect, Ref, Result, type Tracer } from "effect";
import { TFile } from "obsidian";
import { CurrentDispatchSpan } from "../../effect/current-operation";
import type { VamActionOutcome } from "../../effect/dispatch-report";
import type { VamDispatchError } from "../../effect/errors";
import {
	type LinkUpdateSetting,
	type VamLiveServices,
	VaultIo,
} from "../../effect/ports";
import type { TFileHelper } from "../../file-services/background/helpers/tfile-helper";
import { processTransformOf } from "../../helpers/action-helpers";
import { vaultContentHash } from "../../internal/content-hash";
import { splitPathCodec } from "../../split-path-codec";
import type { VamOperation, VamOperationId } from "../../types/event-origin";
import type { AnySplitPath } from "../../types/split-path";
import { type VaultAction, VaultActionKind } from "../../types/vault-action";
import { VaultPath } from "../../vault-path";
import type { ProtectedPaths } from "../protected-paths";
import { type Attribution, EXTERNAL_ATTRIBUTION } from "./callback-sequence";

/**
 * How long after a link-updating rename its predicted rewrites stay
 * expected, and a file's mtime still attributes an unpredicted modification
 * to it. Obsidian rewrites links before `FileManager.renameFile` resolves;
 * the grace covers callbacks that land just after.
 */
export const LINK_REWRITE_GRACE_MS = 5000;

/**
 * Slack before a rename starts, for file systems whose mtime is coarser than
 * the clock.
 */
const MTIME_SLACK_MS = 1000;

/**
 * How long a finished timing window, and a restoration, is kept.
 * Modifications reach subscribers only after their observation window
 * closes, so both must outlive the grace.
 */
const RETENTION_MS = 60_000;

/** The ends of a rename that lets Obsidian rewrite links in other files. */
export type LinkUpdatingRename = {
	readonly from: AnySplitPath;
	readonly to: AnySplitPath;
};

/**
 * The ends of `action` when executing it lets Obsidian rewrite links in
 * other files; `undefined` when it does not.
 */
export function linkUpdatingRename(
	action: VaultAction,
): LinkUpdatingRename | undefined {
	switch (action.kind) {
		case VaultActionKind.RenameFolder:
		case VaultActionKind.RenameMdFile:
			return action.payload.updateLinks === false
				? undefined
				: action.payload;
		case VaultActionKind.RenameFile:
			return action.payload;
		default:
			return undefined;
	}
}

/**
 * A protected file VAM put back after Obsidian's link updater rewrote it,
 * and the rename whose links it held.
 */
export type ProtectedRestoration = {
	readonly operationId: VamOperationId;
	/** The renamed entry, before and after. */
	readonly from: string;
	readonly to: string;
};

/** What renaming one entry may rewrite, read before the rename. */
type Prediction = {
	/** Where each linking file will be once the rename is done. */
	readonly rewrites: readonly string[];
	/** The linking Markdown files under a protected prefix. */
	readonly protectedSources: readonly string[];
	readonly setting: LinkUpdateSetting | "unread";
};

const NO_PREDICTION: Prediction = {
	protectedSources: [],
	rewrites: [],
	setting: "unread",
};

/** One predicted rewrite, open while its rename runs. */
type Expectation = {
	readonly expiresAt: number;
	readonly operationId: VamOperationId;
	/** The span of the rename's Dispatch Batch. */
	readonly span: Tracer.AnySpan | undefined;
	/** Identifies the rename that expects it, so finishing it starts its TTL. */
	readonly rename: object;
};

type Window = {
	readonly start: number;
	/** `undefined` while the rename is still running. */
	readonly end: number | undefined;
	readonly operationId: VamOperationId;
	/** The span of the rename's Dispatch Batch. */
	readonly span: Tracer.AnySpan | undefined;
};

/** A protected file's pre-image, read before the rename. */
type Snapshot = {
	readonly path: string;
	readonly content: string;
	/** `vaultContentHash(content)`. */
	readonly hash: string;
};

/**
 * A protected file VAM read before a rename, while the rename runs. It is
 * `foreign` once anything but the rename's predicted rewrite changed it.
 */
type Guard = {
	readonly rename: object;
	readonly foreign: boolean;
};

type LinkUpdatesOptions = {
	/** Writes the restorations, as a Self Event of the running batch. */
	readonly files: Pick<TFileHelper, "processContent">;
	readonly protectedPaths?: ProtectedPaths;
	readonly graceMs?: number;
};

/**
 * Predicts what Obsidian's link updater rewrites after a VAM rename, so each
 * rewrite is labelled `LinkUpdate` with the rename's operation, and keeps
 * protected files as they were.
 *
 * Before each link-updating rename it reads, from Obsidian's resolved links,
 * the files that link to the renamed file or to a file below the renamed
 * folder. Obsidian's link updater rewrites only links that resolve, and only
 * those whose resolution the rename changes, so these are a superset of what
 * it rewrites to the renamed entry. Each is expected once, at the path it
 * has after the rename, while the rename runs and for one grace after it.
 * A file it moves, or one whose link the rename makes ambiguous, can still
 * be rewritten unpredicted; a modification inside the rename's timing
 * window is labelled `LinkUpdate` with basis `Timing`.
 *
 * A linking file under a protected prefix is read before the rename and
 * written back after it, only if it differs from what was read in link
 * text alone, and behind a check that it still holds what Obsidian wrote,
 * so a hand edit in between is never overwritten. Its links to the renamed
 * entry keep their old text.
 */
export class LinkUpdates {
	private readonly expected = Ref.makeUnsafe<
		ReadonlyMap<string, readonly Expectation[]>
	>(new Map());
	private readonly windows = Ref.makeUnsafe<readonly Window[]>([]);
	private readonly guards = Ref.makeUnsafe<ReadonlyMap<string, Guard>>(
		new Map(),
	);
	private readonly restorations = Ref.makeUnsafe<
		ReadonlyMap<string, ProtectedRestoration & { readonly at: number }>
	>(new Map());
	private readonly files: LinkUpdatesOptions["files"];
	private readonly graceMs: number;
	private readonly protectedPaths: ProtectedPaths | undefined;

	constructor(options: LinkUpdatesOptions) {
		this.files = options.files;
		this.graceMs = options.graceMs ?? LINK_REWRITE_GRACE_MS;
		this.protectedPaths = options.protectedPaths;
	}

	/**
	 * Runs `run`, the link-updating rename `rename` of `operation`, with its
	 * rewrites predicted, and puts back the protected files it rewrote. The
	 * rename's outcome is its own: a restoration that fails is logged, and
	 * the protected-path watcher reports the file as rewritten.
	 */
	readonly aroundRename = Effect.fn("vam.linkUpdates.rename")(function* (
		this: LinkUpdates,
		ends: LinkUpdatingRename,
		operation: VamOperation,
		run: Effect.Effect<VamActionOutcome, VamDispatchError, VamLiveServices>,
	): Effect.fn.Return<VamActionOutcome, VamDispatchError, VamLiveServices> {
		const from = splitPathCodec.format(ends.from);
		const to = splitPathCodec.format(ends.to);
		const prediction = yield* this.predict(from, to);
		const span = yield* CurrentDispatchSpan;
		yield* Effect.annotateCurrentSpan({
			"vam.linkUpdates.predicted": prediction.rewrites.length,
			"vam.linkUpdates.protected": prediction.protectedSources.length,
			"vam.linkUpdates.setting": prediction.setting,
		});
		const rename = {};
		const restoration = {
			from,
			operationId: operation.operationId,
			to,
		};
		// Expectations open uninterruptibly and always close, so an
		// interrupted rename leaves none that never expire.
		return yield* Effect.acquireUseRelease(
			this.snapshot(prediction.protectedSources, rename).pipe(
				Effect.tap(() =>
					this.expect(
						prediction.rewrites,
						operation.operationId,
						span,
						rename,
					),
				),
			),
			() => this.timed(run, operation.operationId, span),
			(snapshots) =>
				Effect.forEach(
					snapshots,
					(snapshot) => this.restore(snapshot, restoration),
					{ discard: true },
				).pipe(Effect.andThen(this.finish(rename))),
		);
	});

	/**
	 * The origin of a modify callback VAM did not write itself: a predicted
	 * rewrite, else one inside a rename's timing window by the file's
	 * `mtime`, else `External`. A predicted rewrite is expected once.
	 */
	readonly attributeEffect = Effect.fnUntraced(function* (
		this: LinkUpdates,
		path: string,
		mtime: number,
	): Effect.fn.Return<Attribution> {
		const now = yield* Clock.currentTimeMillis;
		const key = VaultPath.caseSensitive.key(path);
		const predicted = yield* Ref.modify(this.expected, (expected) => {
			const live = pruneExpected(expected, now);
			const [first, ...rest] = live.get(key) ?? [];
			if (rest.length > 0) live.set(key, rest);
			else live.delete(key);
			return [first, live];
		});
		yield* Ref.update(this.guards, (guards) => {
			const guard = guards.get(key);
			if (guard === undefined || guard.foreign) return guards;
			if (predicted?.rename === guard.rename) return guards;
			return new Map(guards).set(key, { ...guard, foreign: true });
		});
		if (predicted !== undefined)
			return {
				dispatchSpan: predicted.span,
				origin: {
					basis: "Predicted",
					kind: "LinkUpdate",
					operationId: predicted.operationId,
				},
			};
		const timed = yield* Ref.modify(this.windows, (windows) => {
			const live = this.pruneWindows(windows, now);
			const covered = live.findLast(
				({ end, start }) =>
					mtime >= start - MTIME_SLACK_MS &&
					mtime <= (end ?? now) + this.graceMs,
			);
			return [covered, live];
		});
		return timed === undefined
			? EXTERNAL_ATTRIBUTION
			: {
					dispatchSpan: timed.span,
					origin: {
						basis: "Timing",
						kind: "LinkUpdate",
						operationId: timed.operationId,
					},
				};
	});

	/**
	 * The restoration VAM made of the protected file at `path` after a rename
	 * of `operationId`; `undefined` when it made none, or a later rename of
	 * the operation rewrote the file and VAM did not put it back.
	 */
	readonly restorationOf = Effect.fnUntraced(function* (
		this: LinkUpdates,
		path: string,
		operationId: VamOperationId,
	): Effect.fn.Return<ProtectedRestoration | undefined> {
		const now = yield* Clock.currentTimeMillis;
		const restorations = yield* Ref.get(this.restorations);
		const restoration = restorations.get(VaultPath.caseSensitive.key(path));
		return restoration !== undefined &&
			restoration.operationId === operationId &&
			restoration.at + RETENTION_MS >= now
			? {
					from: restoration.from,
					operationId: restoration.operationId,
					to: restoration.to,
				}
			: undefined;
	});

	/**
	 * Who links to the entry at `from`, read just before it moves to `to`. A
	 * failed read predicts nothing: the rename still runs, and its rewrites
	 * are labelled by timing alone.
	 */
	private readonly predict = Effect.fnUntraced(function* (
		this: LinkUpdates,
		from: string,
		to: string,
	): Effect.fn.Return<Prediction, never, VaultIo> {
		const vault = yield* VaultIo;
		const read = yield* Effect.result(vault.linkSources(from));
		if (Result.isFailure(read)) {
			yield* Effect.logWarning(
				"[LinkUpdates] Could not read who links to a renamed entry; its link rewrites are labelled by timing alone",
				{ error: read.failure.message, from },
			);
			return NO_PREDICTION;
		}
		const { setting, sources, target } = read.success;
		if (target === null) return { ...NO_PREDICTION, setting };
		const protectedPaths = this.protectedPaths;
		return {
			protectedSources:
				protectedPaths === undefined
					? []
					: sources.filter(
							(source) =>
								protectedPaths.prefixCovering(source) !==
									undefined && isMarkdownPath(source),
						),
			rewrites: sources.map((source) => movedPath(source, target, to)),
			setting,
		};
	});

	/**
	 * The content of each protected linking file before the rename, each
	 * guarded until `restore` so a change other than `rename`'s predicted
	 * rewrite is noticed.
	 */
	private readonly snapshot = Effect.fnUntraced(function* (
		this: LinkUpdates,
		paths: readonly string[],
		rename: object,
	): Effect.fn.Return<readonly Snapshot[], never, VaultIo> {
		const snapshots: Snapshot[] = [];
		for (const path of paths) {
			const content = yield* readFile(path);
			if (content === undefined) {
				yield* Effect.logWarning(
					"[LinkUpdates] Could not read a protected file that links to a renamed entry; it cannot be put back if Obsidian rewrites it",
					{ path },
				);
				continue;
			}
			snapshots.push({ content, hash: vaultContentHash(content), path });
			yield* Ref.update(this.guards, (guards) =>
				new Map(guards).set(VaultPath.caseSensitive.key(path), {
					foreign: false,
					rename,
				}),
			);
		}
		return snapshots;
	});

	/**
	 * Puts the protected file back as `snapshot` held it, if the rename
	 * changed it, the change was its links alone and no unpredicted write
	 * was heard, and only while it holds what the rename left there.
	 */
	private readonly restore = Effect.fn("vam.linkUpdates.restoreProtected")(
		function* (
			this: LinkUpdates,
			snapshot: Snapshot,
			restoration: ProtectedRestoration,
		): Effect.fn.Return<void, never, VaultIo> {
			yield* Effect.annotateCurrentSpan({ path: snapshot.path });
			const key = VaultPath.caseSensitive.key(snapshot.path);
			const guard = yield* Ref.modify(this.guards, (guards) => {
				const next = new Map(guards);
				next.delete(key);
				return [guards.get(key), next];
			});
			const rewritten = yield* readFile(snapshot.path);
			if (rewritten === undefined) return yield* this.unrestored(key);
			const rewrittenHash = vaultContentHash(rewritten);
			if (rewrittenHash === snapshot.hash) return;
			// Two checks, since either alone can miss a foreign write: a
			// callback can lag the write it reports (or go unheard while no
			// modify subscriber listens), and a write that changes only links
			// looks like the rewrite. Restore only if no unpredicted callback
			// came and the file differs from its pre-image in link text alone.
			if (
				guard?.foreign !== false ||
				!differsOnlyInLinks(snapshot.content, rewritten)
			) {
				yield* this.unrestored(key);
				return yield* Effect.logWarning(
					"[LinkUpdates] Left a protected file as it is: something other than Obsidian's link updater changed it during a rename",
					{
						path: snapshot.path,
						renamed: `${restoration.from} → ${restoration.to}`,
					},
				);
			}
			const splitPath = splitPathCodec.parse(snapshot.path);
			if (splitPath.kind !== "MdFile") return yield* this.unrestored(key);
			// The guarded inverse `dispatchOrUndo` builds for a write: the
			// pre-image back, only while the file holds what the rename left.
			// It runs in the rename's own action, so under its caller and
			// operationId; a dispatched batch would queue behind this one,
			// and dispatch refuses protected paths.
			const written = yield* Effect.result(
				this.files.processContent({
					splitPath,
					transform: processTransformOf({
						expected: { hash: rewrittenHash },
						splitPath,
						transform: () => snapshot.content,
					}),
				}),
			);
			if (Result.isFailure(written)) {
				yield* this.unrestored(key);
				return yield* Effect.logError(
					"[LinkUpdates] Could not put back a protected file Obsidian's link updater rewrote",
					{
						error: written.failure.message,
						path: snapshot.path,
						renamed: `${restoration.from} → ${restoration.to}`,
					},
				);
			}
			const at = yield* Clock.currentTimeMillis;
			yield* Ref.update(this.restorations, (restorations) => {
				const next = new Map(
					[...restorations].filter(
						([, each]) => each.at + RETENTION_MS >= at,
					),
				);
				next.set(VaultPath.caseSensitive.key(snapshot.path), {
					...restoration,
					at,
				});
				return next;
			});
			yield* Effect.logInfo(
				"[LinkUpdates] Put back a protected file Obsidian's link updater rewrote; its links to the renamed entry keep their old text",
				{
					path: snapshot.path,
					renamed: `${restoration.from} → ${restoration.to}`,
				},
			);
		},
	);

	/**
	 * Forgets an earlier restoration of the file at `key`: a later rename of
	 * the same operation rewrote it, and VAM did not put it back this time.
	 */
	private unrestored(key: string): Effect.Effect<void> {
		return Ref.update(this.restorations, (restorations) => {
			if (!restorations.has(key)) return restorations;
			const next = new Map(restorations);
			next.delete(key);
			return next;
		});
	}

	/** Expects each of `paths` once, until `rename` finishes. */
	private readonly expect = Effect.fnUntraced(function* (
		this: LinkUpdates,
		paths: readonly string[],
		operationId: VamOperationId,
		span: Tracer.AnySpan | undefined,
		rename: object,
	): Effect.fn.Return<void> {
		if (paths.length === 0) return;
		const now = yield* Clock.currentTimeMillis;
		yield* Ref.update(this.expected, (expected) => {
			const next = pruneExpected(expected, now);
			for (const path of new Set(
				paths.map((each) => VaultPath.caseSensitive.key(each)),
			))
				next.set(path, [
					...(next.get(path) ?? []),
					{
						expiresAt: Number.POSITIVE_INFINITY,
						operationId,
						rename,
						span,
					},
				]);
			return next;
		});
	});

	/** Starts the grace of `rename`'s unmatched expectations now. */
	private readonly finish = Effect.fnUntraced(function* (
		this: LinkUpdates,
		rename: object,
	): Effect.fn.Return<void> {
		const now = yield* Clock.currentTimeMillis;
		const expiresAt = now + this.graceMs;
		yield* Ref.update(this.expected, (expected) => {
			const next = pruneExpected(expected, now);
			for (const [path, entries] of next)
				next.set(
					path,
					entries.map((entry) =>
						entry.rename === rename
							? { ...entry, expiresAt }
							: entry,
					),
				);
			return next;
		});
	});

	/** Runs `run` inside a recorded timing window of `operationId`. */
	private timed<A, E, R>(
		run: Effect.Effect<A, E, R>,
		operationId: VamOperationId,
		span: Tracer.AnySpan | undefined,
	): Effect.Effect<A, E, R> {
		return Effect.acquireUseRelease(
			Clock.currentTimeMillis.pipe(
				Effect.flatMap((start) => {
					const window: Window = {
						end: undefined,
						operationId,
						span,
						start,
					};
					return Ref.update(this.windows, (windows) => [
						...this.pruneWindows(windows, start),
						window,
					]).pipe(Effect.as(window));
				}),
			),
			() => run,
			(window) =>
				Clock.currentTimeMillis.pipe(
					Effect.flatMap((end) =>
						Ref.update(this.windows, (windows) =>
							windows.map((each) =>
								each === window ? { ...each, end } : each,
							),
						),
					),
				),
		);
	}

	private pruneWindows(
		windows: readonly Window[],
		now: number,
	): readonly Window[] {
		return windows.filter(
			({ end }) =>
				end === undefined || end + this.graceMs + RETENTION_MS >= now,
		);
	}
}

function pruneExpected(
	expected: ReadonlyMap<string, readonly Expectation[]>,
	now: number,
): Map<string, readonly Expectation[]> {
	const live = new Map<string, readonly Expectation[]>();
	for (const [path, entries] of expected) {
		const kept = entries.filter(({ expiresAt }) => expiresAt > now);
		if (kept.length > 0) live.set(path, kept);
	}
	return live;
}

/**
 * Where `source` is once the entry at `target` has moved to `to`: a file
 * that moves with it, the renamed file itself or one below the renamed
 * folder, is rewritten at its new path.
 */
function movedPath(source: string, target: string, to: string): string {
	if (VaultPath.caseSensitive.same(source, target)) return to;
	if (VaultPath.caseSensitive.isUnder(source, target, { inclusive: false }))
		return VaultPath.join(
			to,
			VaultPath.normalize(source).slice(
				VaultPath.normalize(target).length + 1,
			),
		);
	return source;
}

/**
 * The spans Obsidian's link updater rewrites: wikilinks and embeds (also in
 * a property value), and Markdown links and images, with an optional title.
 */
const LINK =
	/!?\[\[(?:(?!\]\])[^\n])*\]\]|!?\[[^\]\n]*\]\((?:<[^>\n]*>|[^)\s]*)(?:\s+"[^"\n]*")?\)/g;

/** `content` without its links: the text around them, in order. */
function textAroundLinks(content: string): string[] {
	const texts: string[] = [];
	let last = 0;
	for (const link of content.matchAll(LINK)) {
		texts.push(content.slice(last, link.index));
		last = link.index + link[0].length;
	}
	texts.push(content.slice(last));
	return texts;
}

/**
 * Whether `after` holds `before` with only links replaced, one for one: what
 * Obsidian's link updater does. Any other change, such as a hand edit or a
 * Sync write landing inside the rename, makes it `false`. A link it does not
 * parse counts as text, so the answer errs towards `false`.
 */
export function differsOnlyInLinks(before: string, after: string): boolean {
	const was = textAroundLinks(before);
	const is = textAroundLinks(after);
	return was.length === is.length && was.every((text, i) => text === is[i]);
}

function isMarkdownPath(path: string): boolean {
	return splitPathCodec.parse(path).kind === "MdFile";
}

/** The file's content on disk; `undefined` when it cannot be read. */
const readFile = Effect.fnUntraced(function* (
	path: string,
): Effect.fn.Return<string | undefined, never, VaultIo> {
	const vault = yield* VaultIo;
	return yield* vault.getAbstractFileByPath(path).pipe(
		Effect.flatMap((file) =>
			file instanceof TFile
				? vault.read(file)
				: Effect.succeed(undefined),
		),
		Effect.orElseSucceed(() => undefined),
	);
});
