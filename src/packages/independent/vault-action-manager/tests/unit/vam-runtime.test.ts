import { describe, expect, it } from "bun:test";
import { Cause, Effect, Exit, Option } from "effect";
import { type App, TFile } from "obsidian";
import {
	VamActiveEditorError,
	VamShutdownError,
	VamVaultIoError,
} from "../../src/effect/errors";
import { ActiveEditorAccess, VaultIo } from "../../src/effect/ports";
import { createVamRuntime } from "../../src/effect/runtime";
import { makeVamLive } from "../../src/effect/vam-live";

function makeApp(overrides: { getAbstractFileByPath?: () => never } = {}) {
	return {
		fileManager: {
			renameFile: async () => {},
			trashFile: async () => {},
		},
		metadataCache: {
			getFirstLinkpathDest: () => null,
		},
		vault: {
			create: async () => {
				throw new Error("not used");
			},
			createFolder: async () => {
				throw new Error("not used");
			},
			getAbstractFileByPath:
				overrides.getAbstractFileByPath ?? (() => null),
			getMarkdownFiles: () => [],
			modify: async () => {},
			read: async () => "",
		},
		workspace: {
			getActiveViewOfType: () => null,
			getLeaf: () => ({ openFile: async () => {} }),
			setActiveLeaf: () => {},
		},
	} as unknown as App;
}

function typedFailure<E>(exit: Exit.Exit<unknown, E>): E | undefined {
	if (Exit.isSuccess(exit)) return undefined;
	return Option.getOrUndefined(Cause.findErrorOption(exit.cause));
}

function makeReadinessApp(options: {
	readonly queryInlineTitle: () => { readonly textContent: string } | null;
}) {
	const file = new TFile();
	file.path = "Library/renamed.md";
	file.basename = "renamed";
	file.extension = "md";
	const editor = {};
	const view = {
		contentEl: {
			querySelector: (selector: string) =>
				selector === ".inline-title" ? options.queryInlineTitle() : {},
		},
		editor,
		file,
		getMode: () => "source",
	};
	const app = makeApp() as unknown as {
		workspace: Record<string, unknown>;
	};
	app.workspace = {
		getActiveViewOfType: () => view,
		getLeaf: () => ({ openFile: async () => {} }),
		offref: () => {},
		on: () => ({}),
		setActiveLeaf: () => {},
	};
	return { app: app as unknown as App, file };
}

async function withMutationObserverStub<A>(
	onObserve: (notify: () => void) => void,
	run: () => Promise<A>,
): Promise<A> {
	const descriptor = Object.getOwnPropertyDescriptor(
		globalThis,
		"MutationObserver",
	);
	class MutationObserverStub {
		constructor(private readonly callback: MutationCallback) {}
		disconnect() {}
		observe() {
			onObserve(() =>
				this.callback([], this as unknown as MutationObserver),
			);
		}
		takeRecords(): MutationRecord[] {
			return [];
		}
	}
	Object.defineProperty(globalThis, "MutationObserver", {
		configurable: true,
		value: MutationObserverStub,
	});
	const documentDescriptor = Object.getOwnPropertyDescriptor(
		globalThis,
		"document",
	);
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: { body: {} },
	});
	try {
		return await run();
	} finally {
		if (descriptor) {
			Object.defineProperty(globalThis, "MutationObserver", descriptor);
		} else {
			Reflect.deleteProperty(globalThis, "MutationObserver");
		}
		if (documentDescriptor) {
			Object.defineProperty(globalThis, "document", documentDescriptor);
		} else {
			Reflect.deleteProperty(globalThis, "document");
		}
	}
}

describe("VamRuntime", () => {
	it("waits until the renamed inline title text is observable", async () => {
		let titleText = "note";
		let queryCount = 0;
		const { app, file } = makeReadinessApp({
			queryInlineTitle: () => {
				queryCount++;
				return { textContent: titleText };
			},
		});
		const runtime = createVamRuntime(makeVamLive(app));

		try {
			const exit = await withMutationObserverStub(
				(notify) => {
					queueMicrotask(() => {
						titleText = "renamed";
						notify();
					});
				},
				() =>
					runtime.runPromiseExit(
						ActiveEditorAccess.use((access) =>
							access.waitForActiveEditor({
								expectedInlineTitleText: "renamed",
								path: "Library/renamed.md",
								readiness: "inline-title",
							}),
						),
					),
			);

			expect(Exit.isSuccess(exit)).toBe(true);
			if (Exit.isFailure(exit))
				throw new Error("Expected readiness success");
			expect(exit.value.file).toBe(file);
			expect(queryCount).toBeGreaterThanOrEqual(2);
		} finally {
			await runtime.dispose();
		}
	});

	it("bounds inline-title readiness and classifies its timeout", async () => {
		const { app } = makeReadinessApp({
			queryInlineTitle: () => ({ textContent: "note" }),
		});
		const runtime = createVamRuntime(makeVamLive(app));

		try {
			const exit = await withMutationObserverStub(
				() => {},
				() =>
					runtime.runPromiseExit(
						ActiveEditorAccess.use((access) =>
							access.waitForActiveEditor({
								expectedInlineTitleText: "renamed",
								path: "Library/renamed.md",
								readiness: "inline-title",
							}),
						),
					),
			);
			const failure = typedFailure(exit);
			expect(failure).toBeInstanceOf(VamActiveEditorError);
			expect((failure as VamActiveEditorError).reason).toBe(
				"ReadinessTimeout",
			);
		} finally {
			await runtime.dispose();
		}
	});

	it("classifies an immediate inline-title DOM read failure", async () => {
		const { app } = makeReadinessApp({
			queryInlineTitle: () => {
				throw new Error("detached DOM");
			},
		});
		const runtime = createVamRuntime(makeVamLive(app));

		try {
			const exit = await runtime.runPromiseExit(
				ActiveEditorAccess.use((access) =>
					access.waitForActiveEditor({
						expectedInlineTitleText: "renamed",
						path: "Library/renamed.md",
						readiness: "inline-title",
					}),
				),
			);
			const failure = typedFailure(exit);
			expect(failure).toBeInstanceOf(VamActiveEditorError);
			expect((failure as VamActiveEditorError).reason).toBe("DomFailure");
		} finally {
			await runtime.dispose();
		}
	});

	it("disposes its live layer finalizers exactly once", async () => {
		let finalizerRuns = 0;
		const runtime = createVamRuntime(
			makeVamLive(makeApp(), {
				onFinalize: () => {
					finalizerRuns++;
				},
			}),
		);

		const initialized = await runtime.runPromiseExit(
			VaultIo.use((vault) => vault.getAbstractFileByPath("Library")),
		);
		expect(Exit.isSuccess(initialized)).toBe(true);

		await Promise.all([runtime.dispose(), runtime.dispose()]);
		await runtime.dispose();

		expect(finalizerRuns).toBe(1);
	});

	it("returns a typed shutdown failure for programs submitted after disposal", async () => {
		const runtime = createVamRuntime(makeVamLive(makeApp()));
		await runtime.dispose();

		const exit = await runtime.runPromiseExit(
			Effect.succeed("unreachable"),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		const failure = typedFailure(exit);
		expect(failure).toBeInstanceOf(VamShutdownError);
		expect((failure as VamShutdownError).cause).toBeInstanceOf(Error);
	});

	it("retains the original cause in VaultIo failures", async () => {
		const original = new Error("lookup failed");
		const runtime = createVamRuntime(
			makeVamLive(
				makeApp({
					getAbstractFileByPath: () => {
						throw original;
					},
				}),
			),
		);

		const exit = await runtime.runPromiseExit(
			VaultIo.use((vault) =>
				vault.getAbstractFileByPath("Library/note.md"),
			),
		);
		await runtime.dispose();

		const failure = typedFailure(exit);
		expect(failure).toBeInstanceOf(VamVaultIoError);
		expect((failure as VamVaultIoError).operation).toBe(
			"getAbstractFileByPath",
		);
		expect((failure as VamVaultIoError).path).toBe("Library/note.md");
		expect((failure as VamVaultIoError).cause).toBe(original);
	});
});
