import {
	type BulkMdModifyEvent,
	type BulkVaultEvent,
	type BulkVaultEventHandler,
	dispatchOrUndoVia,
	EXTERNAL_ORIGIN,
	type ExpectedContent,
	type MdModifyEventHandler,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	type VamActionOutcome,
	VamContentConflictError,
	type VamDispatchEntry,
	VamDispatchError,
	VamDispatchFailure,
	VamDispatchReport,
	VamScanError,
	type VamSubscribeOptions,
	VamTargetExistsError,
	VamVaultIoError,
	type VaultAction,
	VaultActionKind,
	type VaultActionManager,
	type VaultEvent,
	VaultEventKind,
	type VaultEventOrigin,
	type VaultScanPathWithStat,
	vaultContentHash,
} from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import type { DictionaryVault } from "../../src";

type StoredFile = { content: string; mtime: number; size: number };

const format = splitPathCodec.format;

function mdPath(path: string): SplitPathToMdFile {
	const splitPath = splitPathCodec.parse(path);
	if (splitPath.kind !== "MdFile") throw new Error(`Not Markdown: ${path}`);
	return splitPath;
}

function folderPath(path: string): SplitPathToFolder {
	const splitPath = splitPathCodec.parse(path);
	if (splitPath.kind !== "Folder") throw new Error(`Not a folder: ${path}`);
	return splitPath;
}

/** Whether `content` is what a guarded action expects, as VAM checks it. */
const matches = (content: string, expected: ExpectedContent) =>
	typeof expected === "string"
		? content === expected
		: vaultContentHash(content) === expected.hash;

const conflict = (operation: string, path: string) =>
	new VamContentConflictError({
		cause: new Error(`${path} holds other content than expected`),
		operation,
		path,
	});

const under = (path: string, folder: string) =>
	folder === "" || path.startsWith(`${folder}/`);

function bulk(events: VaultEvent[], origin: VaultEventOrigin): BulkVaultEvent {
	const zero = { creates: 0, deletes: 0, renames: 0 };
	return {
		debug: {
			collapsedCount: zero,
			endedAt: 0,
			reduced: { rootDeletes: 0, rootRenames: 0 },
			startedAt: 0,
			trueCount: zero,
		},
		events: events.map((event) => ({ ...event, origin })),
		roots: [],
	};
}

/** Whether a subscription with `options` receives an event of `origin`, as VAM decides. */
function accepts(
	options: VamSubscribeOptions,
	origin: VaultEventOrigin,
): boolean {
	if (origin.kind !== "Vam") return true;
	if (options.from === "all") return true;
	return options.from === "allButMine" && origin.caller !== options.caller;
}

/** A write another VAM caller made, such as the reset's or the migration's. */
export const vamWrite = (caller: string): VaultEventOrigin => ({
	caller,
	kind: "Vam",
	operationId: `${caller}#1`,
});

/**
 * An in-memory vault behind the store's VAM port. Store writes go through
 * `dispatchStopOnFirstFailure` or `dispatchOrUndo` and fire no events: the store subscribes to
 * every origin but its own, as VAM delivers them. The `user*` methods change
 * files as a user or Sync would, or, given an `origin`, as another VAM
 * caller would, and deliver the events VAM would to the subscriptions that
 * take that origin, awaiting the store's handlers.
 */
export class FakeVault implements DictionaryVault {
	readonly files = new Map<string, StoredFile>();
	readonly batches: VaultAction[][] = [];
	readonly readCount = new Map<string, number>();
	/** Paths whose reads fail although the file exists. */
	readonly unreadable = new Set<string>();
	private clock = 1;
	private failWhen: ((action: VaultAction, path: string) => boolean) | null =
		null;
	private readonly bulkHandlers = new Set<{
		handler: (event: BulkVaultEvent) => Effect.Effect<void, unknown>;
		options: VamSubscribeOptions;
	}>();
	private readonly modifyHandlers = new Set<{
		folder: string;
		handler: (event: BulkMdModifyEvent) => Effect.Effect<void, unknown>;
		options: VamSubscribeOptions;
	}>();

	constructor(initial: Record<string, string> = {}) {
		for (const [path, content] of Object.entries(initial))
			this.put(path, content);
	}

	content(path: string): string | undefined {
		return this.files.get(path)?.content;
	}

	markdownPaths(): string[] {
		return [...this.files.keys()]
			.filter((path) => path.endsWith(".md"))
			.sort();
	}

	/**
	 * Makes later writes whose action matches fail, `times` times, as
	 * `io`: VAM reports them `Uncertain`. With `landBeforeFailing`, each
	 * lands first.
	 */
	failNextWrite(
		when: (action: VaultAction, path: string) => boolean,
		times = 1,
		{ landBeforeFailing = false } = {},
	): void {
		this.failWhen = when;
		this.failTimes = times;
		this.landBeforeFailing = landBeforeFailing;
	}

	private landBeforeFailing = false;

	private failTimes = 0;
	scanCount = 0;

	private put(path: string, content: string) {
		this.clock += 1;
		this.files.set(path, {
			content,
			mtime: this.clock,
			size: content.length,
		});
	}

	private folderExists(path: string) {
		return [...this.files.keys()].some((file) => under(file, path));
	}

	exists: DictionaryVault["exists"] = (splitPath) =>
		Effect.sync(() => {
			const path = format(splitPath);
			return splitPath.kind === "Folder"
				? this.folderExists(path)
				: this.files.has(path);
		});

	readContentWithStat: DictionaryVault["readContentWithStat"] = (splitPath) =>
		Effect.suspend(() => {
			const path = format(splitPath);
			this.readCount.set(path, (this.readCount.get(path) ?? 0) + 1);
			const file = this.files.get(path);
			if (!file || this.unreadable.has(path))
				return Effect.fail(
					new VamVaultIoError({
						cause: new Error("File not found"),
						operation: "readContent",
						path,
					}),
				);
			return Effect.succeed({
				content: file.content,
				stat: { ctime: 0, mtime: file.mtime, size: file.size },
			});
		});

	private scanFailures = 0;

	/** Makes the next `count` scans fail, as an unreadable folder would. */
	failNextScans(count = 1): void {
		this.scanFailures = count;
	}

	scanWithStat: DictionaryVault["scanWithStat"] = (folder) =>
		Effect.suspend(() => {
			this.scanCount += 1;
			if (this.scanFailures > 0) {
				this.scanFailures -= 1;
				return Effect.fail(
					new VamScanError({
						cause: new Error("Injected scan failure"),
						operation: "scanRoot",
						path: format(folder),
					}),
				);
			}
			const root = format(folder);
			const entries: VaultScanPathWithStat[] = [];
			for (const [path, file] of this.files) {
				if (!under(path, root) || !path.endsWith(".md")) continue;
				entries.push({
					...mdPath(path),
					read: () =>
						Effect.suspend(() => {
							this.readCount.set(
								path,
								(this.readCount.get(path) ?? 0) + 1,
							);
							return Effect.succeed(
								this.files.get(path)?.content ?? "",
							);
						}),
					stat: { ctime: 0, mtime: file.mtime, size: file.size },
				});
			}
			return Effect.succeed({
				counts: {
					folderCount: 0,
					markdownFileCount: entries.length,
					otherFileCount: 0,
				},
				diagnostics: [],
				entries,
				kind: "Complete",
			} as const);
		});

	/** Runs a batch as VAM would, with an accurate report. */
	dispatchWithReport: VaultActionManager["dispatchWithReport"] = (
		actions,
		{ caller, operationId = `${caller}#1`, stopOnFirstFailure = false },
	) =>
		Effect.promise(async () => {
			this.batches.push([...actions]);
			const entries: VamDispatchEntry[] = [];
			for (const [index, action] of actions.entries()) {
				const path = actionPath(action);
				const fail = this.failWhen?.(action, path) ?? false;
				let failure: unknown = null;
				let outcome: VamActionOutcome | undefined;
				if (fail) {
					this.failTimes -= 1;
					if (this.failTimes <= 0) this.failWhen = null;
					// An action that lands and then fails, as an editor
					// selection restore after a rename may.
					if (this.landBeforeFailing) await this.execute(action);
					failure = new Error(`Injected failure at ${path}`);
				} else
					try {
						outcome = await this.execute(action);
					} catch (cause) {
						failure = cause;
					}
				if (outcome) {
					entries.push({ action, outcome, status: "Done" });
					continue;
				}
				entries.push(
					VamDispatchReport.entryFor(
						new VamDispatchError({
							action,
							cause: failure,
							kind:
								failure instanceof VamContentConflictError
									? "conflict"
									: failure instanceof VamTargetExistsError
										? "exists"
										: "io",
							operation: "execute",
						}),
					),
				);
				if (!stopOnFirstFailure) continue;
				for (const skipped of actions.slice(index + 1))
					entries.push({ action: skipped, status: "Skipped" });
				break;
			}
			return new VamDispatchReport({ caller, entries, operationId });
		}).pipe(
			Effect.flatMap((report) => {
				const failure = VamDispatchFailure.ofReport(report);
				return failure ? Effect.fail(failure) : Effect.succeed(report);
			}),
		);

	dispatchStopOnFirstFailure: DictionaryVault["dispatchStopOnFirstFailure"] =
		(actions, caller) =>
			Effect.asVoid(
				this.dispatchWithReport(actions, {
					...caller,
					stopOnFirstFailure: true,
				}),
			);

	/** VAM's own guarded undo, over this vault. */
	dispatchOrUndo: DictionaryVault["dispatchOrUndo"] = (actions, options) =>
		dispatchOrUndoVia(this, actions, options);

	/** Reads without counting, as VAM's undo probes do. */
	readContent = (splitPath: SplitPathToMdFile) =>
		Effect.suspend(() => {
			const file = this.files.get(format(splitPath));
			return file
				? Effect.succeed(file.content)
				: Effect.fail(new Error(`No file at ${format(splitPath)}`));
		});

	/** Runs one action as VAM and Obsidian would, collisions included. */
	private async execute(action: VaultAction): Promise<VamActionOutcome> {
		switch (action.kind) {
			case VaultActionKind.CreateFile:
			case VaultActionKind.CreateMdFile: {
				// VAM creates only where no file is.
				const path = format(action.payload.splitPath);
				if (this.files.has(path))
					throw new VamTargetExistsError({
						cause: new Error("File already exists."),
						occupiedBy: path,
						operation: "createFile.exists",
						path,
					});
				const content = action.payload.content ?? "";
				this.put(path, content);
				return {
					_tag: "Created",
					contentHash: vaultContentHash(content),
				};
			}
			case VaultActionKind.UpsertMdFile: {
				// VAM overwrites an existing file's content.
				const path = format(action.payload.splitPath);
				const { content } = action.payload;
				const before = this.files.get(path)?.content;
				if (before === undefined) {
					this.put(path, content ?? "");
					return {
						_tag: "Created",
						contentHash: vaultContentHash(content ?? ""),
					};
				}
				if (
					content === null ||
					content === undefined ||
					content === before
				)
					return { _tag: "NoOp" };
				this.put(path, content);
				return {
					_tag: "Wrote",
					afterHash: vaultContentHash(content),
					beforeHash: vaultContentHash(before),
				};
			}
			case VaultActionKind.ProcessMdFile: {
				// VAM processes only an existing file; it does not create one.
				const path = format(action.payload.splitPath);
				const file = this.files.get(path);
				if (!file) throw new Error(`No file at ${path}`);
				const { payload } = action;
				if (
					payload.expected !== undefined &&
					!matches(file.content, payload.expected)
				)
					throw conflict("processFileContent.expected", path);
				const next =
					"transform" in payload
						? await payload.transform(file.content)
						: file.content.replace(payload.before, payload.after);
				if (next === file.content) return { _tag: "NoOp" };
				const before = file.content;
				this.put(path, next);
				return {
					_tag: "Wrote",
					afterHash: vaultContentHash(next),
					beforeHash: vaultContentHash(before),
				};
			}
			case VaultActionKind.RenameMdFile: {
				const from = format(action.payload.from);
				const to = format(action.payload.to);
				const file = this.files.get(from);
				const target = this.files.get(to);
				if (!file) {
					if (target) return { _tag: "NoOp" }; // VAM treats a done rename as done.
					throw new Error(`Both ${from} and ${to} are missing`);
				}
				if (target) {
					// VAM trashes a same-content source, else renames it aside.
					if (target.content === file.content) {
						this.files.delete(from);
						return { _tag: "TrashedDuplicate" };
					}
					const base = to.slice(0, -".md".length);
					let index = 1;
					while (this.files.has(`${base} ${index}.md`)) index += 1;
					this.files.delete(from);
					this.files.set(`${base} ${index}.md`, file);
					return {
						_tag: "RenamedToIndexed",
						to: mdPath(`${base} ${index}.md`),
					};
				}
				this.files.delete(from);
				this.files.set(to, file);
				return { _tag: "Renamed", to: action.payload.to };
			}
			case VaultActionKind.TrashMdFile: {
				// VAM trashes a guarded note only while it holds `ifContent`.
				const path = format(action.payload.splitPath);
				const { ifContent } = action.payload;
				const file = this.files.get(path);
				if (
					file &&
					ifContent !== undefined &&
					!matches(file.content, ifContent)
				)
					throw conflict("trashFile.ifContent", path);
				if (!file) return { _tag: "NoOp" };
				this.files.delete(path);
				return { _tag: "Trashed" };
			}
			default:
				throw new Error(`The fake vault does not run ${action.kind}`);
		}
	}

	subscribeToBulk: DictionaryVault["subscribeToBulk"] = <E>(
		handler: BulkVaultEventHandler<E>,
		options: VamSubscribeOptions = {},
	) =>
		Effect.sync(() => {
			const subscription = { handler, options };
			this.bulkHandlers.add(subscription);
			return {
				// Events are delivered and awaited as they happen.
				caughtUp: Effect.void,
				close: Effect.sync(() => {
					this.bulkHandlers.delete(subscription);
				}),
			};
		});

	subscribeToMdModifications: DictionaryVault["subscribeToMdModifications"] =
		<E>(
			folder: SplitPathToFolder,
			handler: MdModifyEventHandler<E>,
			options: VamSubscribeOptions = {},
		) =>
			Effect.sync(() => {
				const subscription = {
					folder: format(folder),
					handler,
					options,
				};
				this.modifyHandlers.add(subscription);
				return {
					caughtUp: Effect.void,
					close: Effect.sync(() => {
						this.modifyHandlers.delete(subscription);
					}),
				};
			});

	get subscriberCount(): number {
		return this.bulkHandlers.size + this.modifyHandlers.size;
	}

	private async emitBulk(
		events: VaultEvent[],
		origin: VaultEventOrigin = EXTERNAL_ORIGIN,
	) {
		for (const { handler, options } of this.bulkHandlers)
			if (accepts(options, origin))
				await Effect.runPromise(handler(bulk(events, origin)));
	}

	private async emitModify(
		paths: string[],
		origin: VaultEventOrigin = EXTERNAL_ORIGIN,
	) {
		for (const { folder, handler, options } of this.modifyHandlers) {
			if (!accepts(options, origin)) continue;
			const modifications = paths
				.filter((path) => under(path, folder))
				.map((path) => {
					const file = this.files.get(path);
					return {
						origin,
						splitPath: mdPath(path),
						stat: {
							ctime: 0,
							mtime: file?.mtime ?? 0,
							size: file?.size ?? 0,
						},
					};
				});
			if (modifications.length === 0) continue;
			await Effect.runPromise(
				handler({
					debug: {
						endedAt: 0,
						startedAt: 0,
						trueCount: modifications.length,
					},
					modifications,
				}),
			);
		}
	}

	/** A hand edit or Sync write; VAM reports it on the modify channel. */
	async userWrite(
		path: string,
		content: string,
		origin: VaultEventOrigin = EXTERNAL_ORIGIN,
	): Promise<void> {
		const created = !this.files.has(path);
		this.put(path, content);
		if (created)
			await this.emitBulk(
				[{ kind: VaultEventKind.FileCreated, splitPath: mdPath(path) }],
				origin,
			);
		else await this.emitModify([path], origin);
	}

	/** A modify callback for content that did not change, such as an editor save echo. */
	async echo(path: string): Promise<void> {
		await this.emitModify([path]);
	}

	async userRename(from: string, to: string): Promise<void> {
		const file = this.files.get(from);
		if (!file) throw new Error(`No file at ${from}`);
		this.files.delete(from);
		this.files.set(to, file);
		await this.emitBulk([
			{
				from: mdPath(from),
				kind: VaultEventKind.FileRenamed,
				to: mdPath(to),
			},
		]);
	}

	async userRenameFolder(
		from: string,
		to: string,
		origin: VaultEventOrigin = EXTERNAL_ORIGIN,
	): Promise<void> {
		for (const [path, file] of [...this.files])
			if (under(path, from)) {
				this.files.delete(path);
				this.files.set(`${to}${path.slice(from.length)}`, file);
			}
		await this.emitBulk(
			[
				{
					from: folderPath(from),
					kind: VaultEventKind.FolderRenamed,
					to: folderPath(to),
				},
			],
			origin,
		);
	}

	/** Deletes several files at once, as one bulk event. */
	async userDeleteAll(paths: readonly string[]): Promise<void> {
		for (const path of paths) this.files.delete(path);
		await this.emitBulk(
			paths.map((path) => ({
				kind: VaultEventKind.FileDeleted,
				splitPath: mdPath(path),
			})),
		);
	}

	async userDelete(path: string): Promise<void> {
		this.files.delete(path);
		await this.emitBulk([
			{ kind: VaultEventKind.FileDeleted, splitPath: mdPath(path) },
		]);
	}

	/** Changes a file without any event, as a write that bypassed VAM would. */
	silentWrite(path: string, content: string): void {
		this.put(path, content);
	}
}

function actionPath(action: VaultAction): string {
	const payload = action.payload as {
		splitPath?: Parameters<typeof format>[0];
		to?: Parameters<typeof format>[0];
	};
	const target = payload.to ?? payload.splitPath;
	return target ? format(target) : "";
}
