import { Effect, Layer } from "effect";
import { type App, MarkdownView } from "obsidian";
import { DomSelectors } from "../internal/dom-selectors";
import { VamSetupError, VamVaultIoError } from "./errors";
import { VamLoggerLive } from "./logger";
import { ActiveEditorAccess, type VamLiveServices, VaultIo } from "./ports";

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
					getActiveMarkdownView: Effect.try({
						catch: (cause) =>
							new VamVaultIoError({
								cause,
								operation: "getActiveMarkdownView",
							}),
						try: () =>
							app.workspace.getActiveViewOfType(MarkdownView),
					}),
					openFile: Effect.fn("ActiveEditorAccess.openFile")((file) =>
						Effect.gen(function* () {
							const leaf = yield* Effect.try({
								catch: (cause) =>
									new VamVaultIoError({
										cause,
										operation: "getWorkspaceLeaf",
										path: file.path,
									}),
								try: () => app.workspace.getLeaf(false),
							});
							yield* Effect.tryPromise({
								catch: (cause) =>
									new VamVaultIoError({
										cause,
										operation: "openFile",
										path: file.path,
									}),
								try: () => leaf.openFile(file),
							});
							yield* Effect.try({
								catch: (cause) =>
									new VamVaultIoError({
										cause,
										operation: "activateFile",
										path: file.path,
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
						}),
					),
				}),
		}),
	);
}

function waitForViewReady(app: App, path: string, timeoutMs = 500) {
	const failure = (cause: unknown) =>
		new VamVaultIoError({
			cause,
			operation: "waitForViewReady",
			path,
		});
	const checkView = () => {
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		const hasContainer = view?.contentEl.querySelector(
			DomSelectors.CM_CONTENT_CONTAINER,
		);
		return view?.file?.path === path && Boolean(hasContainer);
	};

	return Effect.try({ catch: failure, try: checkView }).pipe(
		Effect.flatMap((ready) => {
			if (ready) return Effect.void;
			const mutation = Effect.callback<void, VamVaultIoError>(
				(resume) => {
					try {
						const observer = new MutationObserver(() => {
							try {
								if (checkView()) resume(Effect.void);
							} catch (cause) {
								resume(Effect.fail(failure(cause)));
							}
						});
						observer.observe(document.body, {
							childList: true,
							subtree: true,
						});
						return Effect.sync(() => observer.disconnect());
					} catch (cause) {
						resume(Effect.fail(failure(cause)));
					}
				},
			);
			return Effect.raceFirst(mutation, Effect.sleep(timeoutMs)).pipe(
				Effect.asVoid,
			);
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
