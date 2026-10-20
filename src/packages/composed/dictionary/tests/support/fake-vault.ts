import {
	type BulkMdModifyEvent,
	type BulkVaultEvent,
	type BulkVaultEventHandler,
	type MdModifyEventHandler,
	type SplitPathToFolder,
	type SplitPathToMdFile,
	splitPathCodec,
	VamDispatchError,
	VamDispatchStoppedError,
	VamVaultIoError,
	type VaultAction,
	VaultActionKind,
	type VaultEvent,
	VaultEventKind,
	type VaultScanPathWithStat,
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

const under = (path: string, folder: string) =>
	folder === "" || path.startsWith(`${folder}/`);

function bulk(events: VaultEvent[]): BulkVaultEvent {
	const zero = { creates: 0, deletes: 0, renames: 0 };
	return {
		debug: {
			collapsedCount: zero,
			endedAt: 0,
			reduced: { rootDeletes: 0, rootRenames: 0 },
			startedAt: 0,
			trueCount: zero,
		},
		events,
		roots: [],
	};
}

/**
 * An in-memory vault behind the store's VAM port. Store writes go through
 * `dispatchStopOnFirstFailure` and, like VAM's Self Events, fire no events;
 * the `user*` methods change files as a user or Sync would and deliver the
 * events VAM would, awaiting the store's handlers.
 */
export class FakeVault implements DictionaryVault {
	readonly files = new Map<string, StoredFile>();
	readonly batches: VaultAction[][] = [];
	readonly readCount = new Map<string, number>();
	private clock = 1;
	private failWhen: ((action: VaultAction, path: string) => boolean) | null =
		null;
	private readonly bulkHandlers = new Set<
		(event: BulkVaultEvent) => Effect.Effect<void, unknown>
	>();
	private readonly modifyHandlers = new Set<{
		folder: string;
		handler: (event: BulkMdModifyEvent) => Effect.Effect<void, unknown>;
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

	/** Makes the first later write whose action matches fail, once. */
	failNextWrite(when: (action: VaultAction, path: string) => boolean): void {
		this.failWhen = when;
	}

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
			if (!file)
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

	scanWithStat: DictionaryVault["scanWithStat"] = (folder) =>
		Effect.sync(() => {
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
			return {
				counts: {
					folderCount: 0,
					markdownFileCount: entries.length,
					otherFileCount: 0,
				},
				diagnostics: [],
				entries,
				kind: "Complete",
			} as const;
		});

	dispatchStopOnFirstFailure: DictionaryVault["dispatchStopOnFirstFailure"] =
		(actions) =>
			Effect.promise(async () => {
				this.batches.push([...actions]);
				const executed: VaultAction[] = [];
				for (const [index, action] of actions.entries()) {
					const path = actionPath(action);
					const fail = this.failWhen?.(action, path) ?? false;
					let failure: unknown = fail
						? new Error(`Injected failure at ${path}`)
						: null;
					if (fail) this.failWhen = null;
					if (!failure)
						try {
							await this.execute(action);
						} catch (cause) {
							failure = cause;
						}
					if (failure)
						return new VamDispatchStoppedError({
							cause: failure,
							executed,
							failure: new VamDispatchError({
								action,
								cause: failure,
								operation: "execute",
							}),
							operation: "dispatch",
							skipped: actions.slice(index + 1),
						});
					executed.push(action);
				}
				return null;
			}).pipe(
				Effect.flatMap((stopped) =>
					stopped ? Effect.fail(stopped) : Effect.void,
				),
			);

	private async execute(action: VaultAction) {
		switch (action.kind) {
			case VaultActionKind.UpsertMdFile: {
				const path = format(action.payload.splitPath);
				const { content } = action.payload;
				if (content === null || content === undefined) {
					if (!this.files.has(path)) this.put(path, "");
				} else this.put(path, content);
				return;
			}
			case VaultActionKind.ProcessMdFile: {
				const path = format(action.payload.splitPath);
				const file = this.files.get(path);
				if (!file) throw new Error(`No file at ${path}`);
				const { payload } = action;
				const next =
					"transform" in payload
						? await payload.transform(file.content)
						: file.content.replace(payload.before, payload.after);
				if (next !== file.content) this.put(path, next);
				return;
			}
			case VaultActionKind.RenameMdFile: {
				const from = format(action.payload.from);
				const to = format(action.payload.to);
				const file = this.files.get(from);
				if (!file) throw new Error(`No file at ${from}`);
				if (this.files.has(to)) throw new Error(`${to} exists`);
				this.files.delete(from);
				this.files.set(to, file);
				return;
			}
			case VaultActionKind.TrashMdFile:
				this.files.delete(format(action.payload.splitPath));
				return;
			default:
				throw new Error(`The fake vault does not run ${action.kind}`);
		}
	}

	subscribeToBulk: DictionaryVault["subscribeToBulk"] = <E>(
		handler: BulkVaultEventHandler<E>,
	) =>
		Effect.sync(() => {
			this.bulkHandlers.add(handler);
			return {
				close: Effect.sync(() => {
					this.bulkHandlers.delete(handler);
				}),
			};
		});

	subscribeToMdModifications: DictionaryVault["subscribeToMdModifications"] =
		<E>(folder: SplitPathToFolder, handler: MdModifyEventHandler<E>) =>
			Effect.sync(() => {
				const subscription = { folder: format(folder), handler };
				this.modifyHandlers.add(subscription);
				return {
					close: Effect.sync(() => {
						this.modifyHandlers.delete(subscription);
					}),
				};
			});

	get subscriberCount(): number {
		return this.bulkHandlers.size + this.modifyHandlers.size;
	}

	private async emitBulk(events: VaultEvent[]) {
		for (const handler of this.bulkHandlers)
			await Effect.runPromise(handler(bulk(events)));
	}

	private async emitModify(paths: string[]) {
		for (const { folder, handler } of this.modifyHandlers) {
			const modifications = paths
				.filter((path) => under(path, folder))
				.map((path) => {
					const file = this.files.get(path);
					return {
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
	async userWrite(path: string, content: string): Promise<void> {
		const created = !this.files.has(path);
		this.put(path, content);
		if (created)
			await this.emitBulk([
				{ kind: VaultEventKind.FileCreated, splitPath: mdPath(path) },
			]);
		else await this.emitModify([path]);
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

	async userRenameFolder(from: string, to: string): Promise<void> {
		for (const [path, file] of [...this.files])
			if (under(path, from)) {
				this.files.delete(path);
				this.files.set(`${to}${path.slice(from.length)}`, file);
			}
		await this.emitBulk([
			{
				from: folderPath(from),
				kind: VaultEventKind.FolderRenamed,
				to: folderPath(to),
			},
		]);
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
