import { Effect, Layer } from "effect";
import { type App, MarkdownView } from "obsidian";
import { DomSelectors } from "../internal/dom-selectors";
import {
	VamActiveEditorError,
	type VamActiveEditorFailureReason,
	VamSetupError,
	VamVaultIoError,
} from "./errors";
import { VamLoggerLive } from "./logger";
import {
	ActiveEditorAccess,
	type ActiveEditorHandle,
	type ActiveEditorReadiness,
	type SavedInlineTitleSelection,
	type VamLiveServices,
	VaultIo,
} from "./ports";

type VamLiveOptions = {
	readonly onFinalize?: () => void;
};

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
							try: () => app.vault.getAbstractFileByPath(path),
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
					rename: Effect.fn("VaultIo.rename")((file, toPath) =>
						Effect.tryPromise({
							catch: (cause) =>
								new VamVaultIoError({
									cause,
									operation: "rename",
									path: `${file.path} -> ${toPath}`,
								}),
							try: () => app.fileManager.renameFile(file, toPath),
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
				}),
		}),
	);
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
		readInlineTitleSelection: () => readInlineTitleSelection(view),
		restoreInlineTitleSelection: (saved) =>
			restoreInlineTitleSelection(view, saved),
	};
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
		if (view?.file?.path !== path) return null;
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

export function makeVamLive(
	app: App,
	options: VamLiveOptions = {},
): Layer.Layer<VamLiveServices, VamSetupError> {
	const lifecycle = Layer.effectDiscard(
		Effect.acquireRelease(Effect.succeed(undefined), () =>
			Effect.sync(() => options.onFinalize?.()),
		),
	);

	return Layer.mergeAll(
		makeVaultIoLive(app),
		makeActiveEditorAccessLive(app),
		VamLoggerLive,
		lifecycle,
	);
}
