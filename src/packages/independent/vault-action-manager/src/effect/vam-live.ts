import { Effect, Layer, Predicate } from "effect";
import {
	type App,
	type EventRef,
	MarkdownView,
	type TAbstractFile,
	TFolder,
	type Vault,
} from "obsidian";
import {
	getAbstractFileByPath,
	toSystemPath,
} from "../internal/abstract-file-by-path";
import { DomSelectors } from "../internal/dom-selectors";
import { detectVaultFileSystem } from "../internal/file-system-case";
import { decodeFileStat } from "../types/file-stat";
import { VaultPath } from "../vault-path";
import {
	VamActiveEditorError,
	type VamActiveEditorFailureReason,
	VamSetupError,
	VamSubscriptionError,
	VamVaultIoError,
} from "./errors";
import {
	ActiveEditorAccess,
	type ActiveEditorHandle,
	type ActiveEditorReadiness,
	HiddenFolderIo,
	type LinkSources,
	type LinkUpdateSetting,
	type SavedInlineTitleSelection,
	type VamPorts,
	VaultIo,
	type VaultListen,
	type VaultListenerCallback,
	type VaultListenerKind,
} from "./ports";

type VamLiveOptions = {
	readonly onFinalize?: () => void;
};

/**
 * `vault.on` for as long as the caller's scope is open, and `offref` when it
 * closes. A failed release is logged; the scope still closes.
 */
export function makeVaultListen(
	vault: Pick<Vault, "offref"> & {
		on(name: VaultListenerKind, callback: never): EventRef;
	},
): VaultListen {
	return Effect.fnUntraced(function* <K extends VaultListenerKind>(
		kind: K,
		callback: VaultListenerCallback<K>,
	) {
		yield* Effect.acquireRelease(
			Effect.try({
				catch: (cause) =>
					new VamSubscriptionError({
						cause,
						operation: `listen for ${kind}`,
					}),
				try: () => vault.on(kind, callback as never),
			}),
			(ref) =>
				Effect.try(() => vault.offref(ref)).pipe(
					Effect.catchCause((cause) =>
						Effect.logError(
							`[VaultObservation] Failed to release ${kind} listener`,
							cause,
						),
					),
				),
		);
	});
}

function makeVaultIoLive(app: App): Layer.Layer<VaultIo, VamSetupError> {
	return Layer.effect(
		VaultIo,
		Effect.try({
			catch: (cause) =>
				new VamSetupError({
					cause,
					operation: "create VaultIo adapter",
				}),
			try: () =>
				VaultIo.of({
					create: Effect.fn("VaultIo.create")((path, content) =>
						Effect.tryPromise({
							catch: (cause) =>
								new VamVaultIoError({
									cause,
									operation: "create",
									path,
								}),
							try: () => app.vault.create(path, content),
						}),
					),
					createFolder: Effect.fn("VaultIo.createFolder")((path) =>
						Effect.tryPromise({
							catch: (cause) =>
								new VamVaultIoError({
									cause,
									operation: "createFolder",
									path,
								}),
							try: () => app.vault.createFolder(path),
						}),
					),
					fileSystem: detectVaultFileSystem(app.vault?.adapter),
					getAbstractFileByPath: Effect.fn(
						"VaultIo.getAbstractFileByPath",
					)((path) =>
						Effect.try({
							catch: (cause) =>
								new VamVaultIoError({
									cause,
									operation: "getAbstractFileByPath",
									path,
								}),
							try: () =>
								getAbstractFileByPath(
									app.vault,
									toSystemPath(path),
								),
						}),
					),
					getMarkdownFiles: Effect.try({
						catch: (cause) =>
							new VamVaultIoError({
								cause,
								operation: "getMarkdownFiles",
							}),
						try: () => app.vault.getMarkdownFiles(),
					}),
					linkSources: Effect.fn("VaultIo.linkSources")((path) =>
						Effect.try({
							catch: (cause) =>
								new VamVaultIoError({
									cause,
									operation: "linkSources",
									path,
								}),
							try: () => readLinkSources(app, path),
						}),
					),
					listen: makeVaultListen(app.vault),
					modify: Effect.fn("VaultIo.modify")((file, content) =>
						Effect.tryPromise({
							catch: (cause) =>
								new VamVaultIoError({
									cause,
									operation: "modify",
									path: file.path,
								}),
							try: () => app.vault.modify(file, content),
						}),
					),
					process: Effect.fn("VaultIo.process")((file, fn) =>
						Effect.tryPromise({
							catch: (cause) =>
								new VamVaultIoError({
									cause,
									operation: "process",
									path: file.path,
								}),
							try: () => app.vault.process(file, fn),
						}),
					),
					read: Effect.fn("VaultIo.read")((file) =>
						Effect.tryPromise({
							catch: (cause) =>
								new VamVaultIoError({
									cause,
									operation: "read",
									path: file.path,
								}),
							try: () => app.vault.read(file),
						}),
					),
					rename: Effect.fn("VaultIo.rename")(
						(file, toPath, options) =>
							Effect.tryPromise({
								catch: (cause) =>
									new VamVaultIoError({
										cause,
										operation: "rename",
										path: `${file.path} -> ${toPath}`,
									}),
								try: () =>
									options?.updateLinks === false
										? app.vault.rename(file, toPath)
										: app.fileManager.renameFile(
												file,
												toPath,
											),
							}),
					),
					resolveLinkpathDest: Effect.fn(
						"VaultIo.resolveLinkpathDest",
					)((linkpath, fromPath) =>
						Effect.try({
							catch: (cause) =>
								new VamVaultIoError({
									cause,
									operation: "resolveLinkpathDest",
									path: fromPath,
								}),
							try: () =>
								app.metadataCache.getFirstLinkpathDest(
									linkpath,
									fromPath,
								),
						}),
					),
					stat: Effect.fn("VaultIo.stat")((file) =>
						decodeFileStat(file.stat).pipe(
							Effect.mapError(
								(cause) =>
									new VamVaultIoError({
										cause,
										operation: "stat",
										path: file.path,
									}),
							),
						),
					),
					trash: Effect.fn("VaultIo.trash")((file) =>
						Effect.tryPromise({
							catch: (cause) =>
								new VamVaultIoError({
									cause,
									operation: "trash",
									path: file.path,
								}),
							try: () => app.fileManager.trashFile(file),
						}),
					),
					tree: app.vault,
				}),
		}),
	);
}

/**
 * Who links to the entry at `path`, from `MetadataCache.resolvedLinks`:
 * the links Obsidian's link updater considers, since it rewrites only
 * links that resolve. A folder's are those to any file below it.
 *
 * One pass over the resolved links, with a set lookup per link: a folder's
 * files are collected once from Obsidian's tree, whose paths are the keys
 * `resolvedLinks` uses, so no link is normalized or compared by prefix.
 */
function readLinkSources(app: App, path: string): LinkSources {
	const setting = readLinkUpdateSetting(app);
	const entry = getAbstractFileByPath(app.vault, toSystemPath(path));
	if (!entry) return { setting, sources: [], target: null };
	const targets =
		entry instanceof TFolder
			? filesBelow(entry)
			: new Set<string>([entry.path]);
	const sources: string[] = [];
	if (targets.size > 0)
		for (const [source, destinations] of Object.entries(
			app.metadataCache.resolvedLinks,
		))
			for (const destination in destinations)
				if (targets.has(destination)) {
					sources.push(source);
					break;
				}
	return { setting, sources, target: entry.path };
}

/** The paths of every file below `folder`, as Obsidian keys them. */
function filesBelow(folder: TFolder): Set<string> {
	const files = new Set<string>();
	const pending: TAbstractFile[] = [...folder.children];
	for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
		if (next instanceof TFolder) pending.push(...next.children);
		else files.add(next.path);
	}
	return files;
}

/** `alwaysUpdateLinks`, which `Vault.getConfig` answers outside the typings. */
function readLinkUpdateSetting(app: App): LinkUpdateSetting {
	const vault = app.vault as unknown as {
		getConfig?: (key: string) => unknown;
	};
	return vault.getConfig?.("alwaysUpdateLinks") === true ? "always" : "ask";
}

function makeActiveEditorAccessLive(
	app: App,
): Layer.Layer<ActiveEditorAccess, VamSetupError> {
	return Layer.effect(
		ActiveEditorAccess,
		Effect.try({
			catch: (cause) =>
				new VamSetupError({
					cause,
					operation: "create ActiveEditorAccess adapter",
				}),
			try: () =>
				ActiveEditorAccess.of({
					getActiveEditor: Effect.try({
						catch: (cause) =>
							new VamActiveEditorError({
								cause,
								operation: "getActiveEditor",
								reason: "AdapterFailure",
							}),
						try: () => readActiveEditor(app),
					}),
					// Untraced: every content read of a file the active
					// view does not show asks it.
					markdownViewsOf: (path) =>
						Effect.try({
							catch: (cause) =>
								new VamActiveEditorError({
									cause,
									operation: "markdownViewsOf",
									path,
									reason: "AdapterFailure",
								}),
							try: () => readMarkdownViewsOf(app, path),
						}),
					openFile: Effect.fn("ActiveEditorAccess.openFile")(
						function* (file) {
							const leaf = yield* Effect.try({
								catch: (cause) =>
									new VamActiveEditorError({
										cause,
										operation: "getWorkspaceLeaf",
										path: file.path,
										reason: "NavigationFailure",
									}),
								try: () => app.workspace.getLeaf(false),
							});
							yield* Effect.tryPromise({
								catch: (cause) =>
									new VamActiveEditorError({
										cause,
										operation: "openFile",
										path: file.path,
										reason: "NavigationFailure",
									}),
								try: () => leaf.openFile(file),
							});
							yield* Effect.try({
								catch: (cause) =>
									new VamActiveEditorError({
										cause,
										operation: "activateFile",
										path: file.path,
										reason: "NavigationFailure",
									}),
								try: () => {
									app.workspace.setActiveLeaf(leaf, {
										focus: true,
									});
									const leftSplit = app.workspace
										.leftSplit as unknown as {
										collapsed: boolean;
									} | null;
									if (leftSplit && !leftSplit.collapsed) {
										const explorerLeaves =
											app.workspace.getLeavesOfType(
												"file-explorer",
											);
										if (explorerLeaves.length > 0) {
											(
												app as unknown as {
													commands: {
														executeCommandById(
															id: string,
														): void;
													};
												}
											).commands.executeCommandById(
												"file-explorer:reveal-active-file",
											);
										}
									}
								},
							});
							yield* waitForViewReady(app, file.path);
						},
					),
					openMarkdownPaths: Effect.try({
						catch: (cause) =>
							new VamActiveEditorError({
								cause,
								operation: "openMarkdownPaths",
								reason: "AdapterFailure",
							}),
						try: () => readOpenMarkdownPaths(app),
					}),
					waitForActiveEditor: ({
						expectedInlineTitleText,
						path,
						readiness,
					}) =>
						waitForViewReady(
							app,
							path,
							readiness,
							expectedInlineTitleText,
						),
				}),
		}),
	);
}

function readOpenMarkdownPaths(app: App): ReadonlySet<string> {
	const paths = new Set<string>();
	for (const leaf of app.workspace.getLeavesOfType("markdown")) {
		const view = leaf.view;
		if (view instanceof MarkdownView && view.file)
			paths.add(view.file.path);
	}
	return paths;
}

/**
 * The loaded Markdown views of the file at `path`, in every window. A
 * deferred tab (not yet shown since startup) is no `MarkdownView` and holds
 * no buffer, so it is not listed.
 */
function readMarkdownViewsOf(
	app: App,
	path: string,
): readonly ActiveEditorHandle[] {
	const handles: ActiveEditorHandle[] = [];
	for (const leaf of app.workspace.getLeavesOfType("markdown")) {
		const view = leaf.view;
		if (
			view instanceof MarkdownView &&
			view.file &&
			VaultPath.caseSensitive.same(view.file.path, path)
		)
			handles.push(readActiveEditorFromView(view));
	}
	return handles;
}

function readActiveEditor(app: App): ActiveEditorHandle | null {
	const view = app.workspace.getActiveViewOfType(MarkdownView);
	if (!view) return null;
	return readActiveEditorFromView(view);
}

function readActiveEditorFromView(view: MarkdownView): ActiveEditorHandle {
	const file = view.file;
	const editor = view.editor;
	const mode = view.getMode();
	const path = file?.path;
	return {
		editor,
		file,
		isCurrent: () =>
			view.file === file &&
			view.editor === editor &&
			view.file?.path === path &&
			view.getMode() === mode,
		mode,
		persisted: () => readPersisted(view),
		readInlineTitleSelection: () => readInlineTitleSelection(view),
		restoreInlineTitleSelection: (saved) =>
			restoreInlineTitleSelection(view, saved),
		viewData: () => view.getViewData(),
	};
}

/**
 * `TextFileView.lastSavedData` and `saving`, Obsidian internals: what the
 * view last loaded from or saved to disk (`null` before it loads), and
 * whether a save is writing. `undefined` when they are not there.
 */
function readPersisted(
	view: MarkdownView,
): { readonly data: string | null; readonly saving: boolean } | undefined {
	const internals = view as unknown as {
		readonly lastSavedData?: unknown;
		readonly saving?: unknown;
	};
	const data = internals.lastSavedData;
	if (!(data === null || Predicate.isString(data))) return undefined;
	return { data, saving: internals.saving === true };
}

function readInlineTitleSelection(
	view: MarkdownView,
): SavedInlineTitleSelection | null {
	const element = view.contentEl.querySelector(
		DomSelectors.INLINE_TITLE,
	) as HTMLElement | null;
	if (!element || document.activeElement !== element) return null;
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) return null;
	const range = selection.getRangeAt(0);
	if (!element.contains(range.commonAncestorContainer)) return null;
	const text = element.textContent ?? "";
	const selectAll =
		range.startContainer === element || range.endContainer === element;
	return {
		end: selectAll ? text.length : range.endOffset,
		start: selectAll ? 0 : range.startOffset,
		text,
	};
}

function restoreInlineTitleSelection(
	view: MarkdownView,
	saved: SavedInlineTitleSelection,
): void {
	const element = view.contentEl.querySelector(
		DomSelectors.INLINE_TITLE,
	) as HTMLElement | null;
	if (!element) throw new Error("No inline title element");
	element.focus();
	const selection = window.getSelection();
	if (!selection) throw new Error("No selection API");
	const textNode = element.firstChild;
	if (!textNode) throw new Error("No text node in inline title");
	const range = document.createRange();
	const textLength = textNode.textContent?.length ?? 0;
	range.setStart(textNode, Math.min(saved.start, textLength));
	range.setEnd(textNode, Math.min(saved.end, textLength));
	selection.removeAllRanges();
	selection.addRange(range);
}

function waitForViewReady(
	app: App,
	path: string,
	readiness: ActiveEditorReadiness = "editor",
	expectedInlineTitleText?: string,
	timeoutMs = 500,
) {
	const failure = (reason: VamActiveEditorFailureReason, cause: unknown) =>
		new VamActiveEditorError({
			cause,
			operation: "waitForViewReady",
			path,
			reason,
		});
	const checkView = (): ActiveEditorHandle | null => {
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.file || !VaultPath.caseSensitive.same(view.file.path, path))
			return null;
		if (readiness === "inline-title") {
			const title = view.contentEl.querySelector(
				DomSelectors.INLINE_TITLE,
			);
			if (
				!title ||
				(expectedInlineTitleText !== undefined &&
					title.textContent !== expectedInlineTitleText)
			) {
				return null;
			}
		} else if (
			view.getMode() === "source" &&
			!view.contentEl.querySelector(DomSelectors.CM_CONTENT_CONTAINER)
		) {
			return null;
		}
		return readActiveEditorFromView(view);
	};

	return Effect.try({
		catch: (cause) =>
			failure(
				readiness === "inline-title" ? "DomFailure" : "AdapterFailure",
				cause,
			),
		try: checkView,
	}).pipe(
		Effect.flatMap((ready) => {
			if (ready) return Effect.succeed(ready);
			const mutation = Effect.callback<
				ActiveEditorHandle,
				VamActiveEditorError
			>((resume) => {
				try {
					const checkAndResume = () => {
						try {
							const current = checkView();
							if (current) resume(Effect.succeed(current));
						} catch (cause) {
							resume(Effect.fail(failure("DomFailure", cause)));
						}
					};
					const observer = new MutationObserver(checkAndResume);
					const eventRefs = [
						app.workspace.on("active-leaf-change", checkAndResume),
						app.workspace.on("file-open", checkAndResume),
					];
					observer.observe(document.body, {
						childList: true,
						subtree: true,
					});
					checkAndResume();
					return Effect.sync(() => {
						observer.disconnect();
						for (const ref of eventRefs) app.workspace.offref(ref);
					});
				} catch (cause) {
					resume(Effect.fail(failure("DomFailure", cause)));
				}
			});
			const timeout = Effect.sleep(timeoutMs).pipe(
				Effect.andThen(
					Effect.fail(
						failure(
							"ReadinessTimeout",
							new Error(
								`Active editor did not reach ${readiness} readiness within ${timeoutMs}ms`,
							),
						),
					),
				),
			);
			return Effect.raceFirst(mutation, timeout);
		}),
	);
}

/**
 * Files under dot-folders, through `vault.adapter`: Obsidian keeps them out
 * of its tree and fires no vault callback for them.
 */
function makeHiddenFolderIoLive(app: App): Layer.Layer<HiddenFolderIo> {
	const attempt = <A>(
		operation: string,
		path: string,
		run: (adapter: App["vault"]["adapter"]) => Promise<A>,
	) =>
		Effect.tryPromise({
			catch: (cause) =>
				new VamVaultIoError({
					cause,
					operation: `hiddenFolder.${operation}`,
					path,
				}),
			try: () => run(app.vault.adapter),
		});
	return Layer.succeed(
		HiddenFolderIo,
		HiddenFolderIo.of({
			exists: Effect.fn("HiddenFolderIo.exists")((path) =>
				attempt("exists", path, (adapter) => adapter.exists(path)),
			),
			mkdir: Effect.fn("HiddenFolderIo.mkdir")((path) =>
				attempt("mkdir", path, (adapter) => adapter.mkdir(path)),
			),
			read: Effect.fn("HiddenFolderIo.read")((path) =>
				attempt("read", path, (adapter) => adapter.read(path)),
			),
			write: Effect.fn("HiddenFolderIo.write")((path, data) =>
				attempt("write", path, (adapter) => adapter.write(path, data)),
			),
		}),
	);
}

/**
 * VAM's ports over Obsidian's `App`: the only place VAM reads it. Brings no
 * tracer or logger; the Vault Action Manager's Layer decides those.
 */
export function makeVamLive(
	app: App,
	options: VamLiveOptions = {},
): Layer.Layer<VamPorts, VamSetupError> {
	const lifecycle = Layer.effectDiscard(
		Effect.acquireRelease(Effect.succeed(undefined), () =>
			Effect.sync(() => options.onFinalize?.()),
		),
	);

	return Layer.mergeAll(
		makeVaultIoLive(app),
		makeActiveEditorAccessLive(app),
		makeHiddenFolderIoLive(app),
		lifecycle,
	);
}
