import { describe, expect, it } from "bun:test";
import { VaultActionManager } from "@textfresser/vault-action-manager";
import {
	makeRecentTrace,
	type RecentTrace,
	type RecordedSpan,
} from "@textfresser/vault-action-manager/diagnostics";
import type * as Dumling from "dumling/types";
import { Cause, Deferred, Effect, Exit, Layer, Scope } from "effect";
import type { App } from "obsidian";
import { makeKnowledgeQueue } from "../../../src/commanders/classify/resolution/knowledge-queue";
import type { KnowledgeJob } from "../../../src/commanders/classify/resolution/knowledge-types";
import { Librarian } from "../../../src/commanders/librarian/librarian";
import { createLifecycleNotices } from "../../../src/lifecycle/lifecycle-notices";
import {
	type LaunchedPlugin,
	Lifecycle,
	type LifecycleSupervisor,
	type TaggedFailure,
} from "../../../src/lifecycle/lifecycle-supervisor";
import { makeObsidianVault } from "../../../src/packages/independent/vault-action-manager/tests/unit/helpers/obsidian-vault";
import { ObservabilityLive } from "../../../src/runtime/observability";
import { PluginLive } from "../../../src/runtime/plugin-live";
import {
	makePluginRuntime,
	PluginEdgeError,
} from "../../../src/runtime/plugin-runtime";
import { Settings } from "../../../src/settings/settings-service";
import { DEFAULT_SETTINGS } from "../../../src/types";
import { IdleTracker } from "../../../src/utils/idle-tracker";
import { fakeHost } from "../../support/obsidian-host";
import {
	fixedSettings,
	memoryPluginData,
} from "../common-utils/test-settings";
import { unreachable } from "../dumgen/dumgen-support";

const RAMEN = "Library/Soup/Ramen";

/** Lets every fiber and promise that can move, move. */
async function until(done: () => boolean): Promise<void> {
	for (let round = 0; round < 500 && !done(); round++)
		await new Promise((resolve) => setTimeout(resolve, 5));
	if (!done()) throw new Error("timed out");
}

/** The names of `span`'s descendants, `span` itself first. */
function subtree(spans: readonly RecordedSpan[], root: RecordedSpan): string[] {
	const children = (id: string) => spans.filter((s) => s.parentId === id);
	const names: string[] = [];
	const visit = (span: RecordedSpan) => {
		names.push(span.name);
		for (const child of children(span.spanId)) visit(child);
	};
	visit(root);
	return names;
}

function only(trace: RecentTrace, name: string): RecordedSpan {
	const found = trace.snapshot().spans.filter((span) => span.name === name);
	expect(found).toHaveLength(1);
	return found[0] as RecordedSpan;
}

describe("PluginRuntime edges", () => {
	it("runs a command under its root span, logs its failure there, and resolves", async () => {
		const trace = makeRecentTrace();
		const runtime = makePluginRuntime(ObservabilityLive(trace), {
			onBuildFailed: () => {},
		});
		await runtime.command(
			"split-to-pages",
			Effect.fail(new Error("boom")).pipe(Effect.withSpan("Inner.step")),
		);

		const command = only(trace, "command.split-to-pages");
		expect(command.parentId).toBeUndefined();
		expect(command.status).toBe("failed");
		expect(only(trace, "Inner.step").parentId).toBe(command.spanId);
		const logged = trace
			.snapshot()
			.logs.filter((log) => log.spanId === command.spanId);
		expect(logged).toHaveLength(1);
		expect(logged[0]?.level).toBe("ERROR");
		expect(logged[0]?.cause).toContain("boom");
		await runtime.dispose();
	});

	it("rejects an E2E hook with its whole cause, and runs nothing at an edge after dispose", async () => {
		const trace = makeRecentTrace();
		const runtime = makePluginRuntime(ObservabilityLive(trace), {
			onBuildFailed: () => {},
		});
		expect(await runtime.e2e("when-idle", Effect.succeed(7))).toBe(7);
		const rejected = await runtime
			.e2e("when-settled", Effect.fail("not settled"))
			.then(
				() => undefined,
				(error: unknown) => error,
			);
		expect(rejected).toBeInstanceOf(PluginEdgeError);
		const edgeError = rejected as PluginEdgeError;
		expect(edgeError.edge).toBe("e2e.when-settled");
		expect(Cause.isCause(edgeError.cause)).toBe(true);
		expect(edgeError.message).toContain("not settled");

		await runtime.dispose();
		let ran = false;
		const late = Effect.sync(() => {
			ran = true;
		});
		await runtime.command("restart-librarian", late);
		await runtime.userEvent("codex-checkbox", late);
		await runtime.settings(late);
		runtime.onload(late);
		expect(Exit.isFailure(runtime.readSync(late))).toBe(true);
		const afterDispose = await runtime.e2e("when-idle", late).then(
			() => undefined,
			(error: unknown) => error,
		);
		expect(afterDispose).toBeInstanceOf(PluginEdgeError);
		expect(ran).toBe(false);
	});

	it("tells a failed build once, with its whole cause, and runs no program", async () => {
		const failures: Cause.Cause<unknown>[] = [];
		const runtime = makePluginRuntime(
			Layer.effectDiscard(Effect.fail(new Error("no vault"))),
			{ onBuildFailed: (cause) => failures.push(cause) },
		);
		let ran = false;
		await runtime.command(
			"classify",
			Effect.sync(() => {
				ran = true;
			}),
		);
		await until(() => failures.length > 0);
		expect(failures).toHaveLength(1);
		expect(Cause.pretty(failures[0] as Cause.Cause<unknown>)).toContain(
			"no vault",
		);
		expect(ran).toBe(false);
		await runtime.dispose();
	});
});

describe("PluginLive", () => {
	/** The plugin runtime over an in-memory vault, with its own trace. */
	function makePlugin(
		vault: ReturnType<typeof makeObsidianVault>,
		options: {
			readonly slowShutdown?: number;
			readonly data?: ReturnType<typeof memoryPluginData>;
		} = {},
	) {
		const trace = makeRecentTrace();
		const runtime = makePluginRuntime(
			PluginLive(vault.app as unknown as App, {
				data: options.data ?? memoryPluginData(),
				host: fakeHost().layer,
				notices: createLifecycleNotices(() => {}, {
					trace,
					writeStop: () => {},
				}),
				requestUrl: unreachable,
				...(options.slowShutdown === undefined
					? {}
					: { slowShutdown: options.slowShutdown }),
				trace,
			}),
			{
				onBuildFailed: (cause) => {
					throw new Error(Cause.pretty(cause));
				},
			},
		);
		let lifecycle: LifecycleSupervisor<Librarian> | null = null;
		/** Launches as `onload` does, with `wire` building the services. */
		const launch = async (
			wire: (
				vam: VaultActionManager,
			) => Effect.Effect<
				LaunchedPlugin<Librarian>,
				TaggedFailure,
				Scope.Scope
			>,
		) => {
			runtime.onload(
				Effect.gen(function* () {
					const vam = yield* VaultActionManager;
					lifecycle = yield* Lifecycle;
					yield* lifecycle.launch(
						Effect.gen(function* () {
							yield* vam.startListening();
							return yield* wire(vam);
						}),
					);
				}),
			);
			await until(() => lifecycle?.state().kind === "Running");
			return runtime.e2e("vam", Effect.service(VaultActionManager));
		};
		return {
			launch,
			lifecycle: () => lifecycle as LifecycleSupervisor<Librarian>,
			runtime,
			trace,
			vault,
		};
	}

	const launched = (
		makeLibrarian: LaunchedPlugin<Librarian>["makeLibrarian"],
	): LaunchedPlugin<Librarian> => ({
		attachLibrarian: () => () => {},
		loadStore: Effect.void,
		makeLibrarian,
		onLaunched: () => Effect.void,
		resetRunning: () => false,
		sweep: Effect.void,
	});

	const librarianOver =
		(vam: VaultActionManager): LaunchedPlugin<Librarian>["makeLibrarian"] =>
		(onStopped) =>
			Librarian.make(vam, { onStopped, settings: fixedSettings() });

	it("shows a Librarian restart as one tree: the command, the Librarian's start, VAM's scan and dispatch", async () => {
		const plugin = makePlugin(
			makeObsidianVault({ [`${RAMEN}/Anchor-Ramen-Soup.md`]: "" }),
		);
		const vam = await plugin.launch((manager) =>
			Effect.succeed(launched(librarianOver(manager))),
		);
		try {
			expect(plugin.lifecycle().librarianState().kind).toBe("Running");
			const onload = only(plugin.trace, "obsidian.onload");
			expect(subtree(plugin.trace.snapshot().spans, onload)).toEqual(
				expect.arrayContaining([
					"Lifecycle.Launch",
					"Librarian.init",
					"vam.scanAndSubscribe",
				]),
			);

			// Paused, the Librarian does not hear this file; its restart heals it.
			await plugin.runtime.command(
				"pause",
				plugin.lifecycle().pause("DelimiterMigration"),
			);
			await plugin.vault.createByHand(`${RAMEN}/Offline.md`);
			await plugin.runtime.command(
				"restart-librarian",
				plugin.lifecycle().restart,
			);
			await plugin.runtime.e2e("when-settled", vam.testing.whenSettled());

			expect(plugin.vault.files()).toContain(
				`${RAMEN}/Offline-Ramen-Soup.md`,
			);
			const { spans } = plugin.trace.snapshot();
			const restart = only(plugin.trace, "command.restart-librarian");
			expect(restart.parentId).toBeUndefined();
			const tree = subtree(spans, restart);
			expect(tree.slice(0, 2)).toEqual([
				"command.restart-librarian",
				"Lifecycle.Restart",
			]);
			expect(tree).toEqual(
				expect.arrayContaining([
					"Librarian.init",
					"vam.scanAndSubscribe",
					"vam.dispatch",
					"DispatchBatch.executeBatch",
				]),
			);
		} finally {
			await plugin.runtime.dispose();
		}
	}, 30_000);

	it("loads the settings from data.json as it builds; a change restarts the Librarian under it, as one tree, and is stored", async () => {
		const data = memoryPluginData({ openaiApiKey: "sk-stored" });
		const plugin = makePlugin(
			makeObsidianVault({ [`${RAMEN}/Anchor-Ramen-Soup.md`]: "" }),
			{ data },
		);
		const settings = await plugin.runtime.e2e(
			"settings",
			Effect.service(Settings),
		);
		expect(settings.now().openaiApiKey).toBe("sk-stored");
		await plugin.launch((manager) =>
			Effect.succeed(
				launched(
					(onStopped) => Librarian.make(manager, { onStopped, settings }),
				),
			),
		);
		try {
			expect(plugin.lifecycle().librarian()?.codecRules?.showScrollBacklinks).toBe(true);

			await plugin.runtime.settings(
				settings.update({ showScrollBacklinks: false }),
			);

			expect(plugin.lifecycle().librarian()?.codecRules?.showScrollBacklinks).toBe(false);
			expect(data.saved).toEqual([
				{
					...DEFAULT_SETTINGS,
					openaiApiKey: "sk-stored",
					showScrollBacklinks: false,
				},
			]);
			const edge = only(plugin.trace, "settings.update");
			expect(edge.parentId).toBeUndefined();
			expect(subtree(plugin.trace.snapshot().spans, edge)).toEqual(
				expect.arrayContaining([
					"Settings.update",
					"Lifecycle.Reconfigure",
					"Librarian.init",
					"PluginData.save",
				]),
			);
		} finally {
			await plugin.runtime.dispose();
		}
	}, 30_000);

	it("disposes newest first: the services the launch built, then the Librarian, then VAM", async () => {
		const released: string[] = [];
		const plugin = makePlugin(
			makeObsidianVault({ [`${RAMEN}/Anchor-Ramen-Soup.md`]: "" }),
		);
		/** Records `what`, and whether VAM still answered then. */
		const record = (vam: VaultActionManager, what: string) =>
			Effect.exit(vam.mdPwd()).pipe(
				Effect.map((exit) => {
					released.push(`${what}: VAM ${Exit.isSuccess(exit) ? "up" : "down"}`);
				}),
			);
		const vam = await plugin.launch((manager) =>
			Effect.gen(function* () {
				yield* Effect.addFinalizer(() => record(manager, "store"));
				yield* Effect.addFinalizer(() => record(manager, "observer"));
				return {
					...launched((onStopped) =>
						// Its scope closes newest first: recorded, then
						// unsubscribed.
						Librarian.make(manager, {
							onStopped,
							settings: fixedSettings(),
						}).pipe(
							Effect.tap(() =>
								Effect.addFinalizer(() =>
									record(manager, "librarian"),
								),
							),
						),
					),
					onLaunched: () =>
						Effect.addFinalizer(() => record(manager, "overlay")),
				};
			}),
		);

		await plugin.runtime.dispose();

		expect(released).toEqual([
			"overlay: VAM up",
			"observer: VAM up",
			"store: VAM up",
			"librarian: VAM up",
		]);
		const read = await Effect.runPromiseExit(vam.mdPwd());
		expect(Exit.isFailure(read)).toBe(true);
		expect(plugin.lifecycle().state().kind).toBe("Stopped");
		const shutdown = only(plugin.trace, "vam.shutdown");
		expect(shutdown.status).toBe("ok");
	}, 30_000);

	it("never cuts the vault batch in flight on unload: it waits for it, and logs that it waits", async () => {
		const vault = makeObsidianVault({
			[`${RAMEN}/Anchor-Ramen-Soup.md`]: "",
		});
		const obsidian = vault.app.vault as unknown as {
			create: (path: string, content: string) => Promise<unknown>;
		};
		const createNow = obsidian.create;
		const gate = Deferred.makeUnsafe<void>();
		const reached = Deferred.makeUnsafe<void>();
		let held = false;
		obsidian.create = (path, content) =>
			(held
				? Effect.runPromise(
						Deferred.succeed(reached, undefined).pipe(
							Effect.andThen(Deferred.await(gate)),
						),
					)
				: Promise.resolve()
			).then(() => createNow(path, content));
		const plugin = makePlugin(vault, { slowShutdown: 20 });
		const vam = await plugin.launch((manager) =>
			Effect.succeed(launched(librarianOver(manager))),
		);
		held = true;
		// Its submitter is an edge: the hook rejects with the cause it ends with.
		const inFlight = plugin.runtime
			.e2e(
				"dispatch",
				vam.dispatch(
					[
						{
							kind: "UpsertMdFile",
							payload: {
								content: "held",
								splitPath: {
									basename: "Held",
									extension: "md",
									kind: "MdFile",
									pathParts: [],
								},
							},
						} as never,
					],
					{ caller: "test" },
				),
			)
			.then(
				() => undefined,
				(error: PluginEdgeError) => error.cause,
			);
		await Effect.runPromise(Deferred.await(reached));

		let disposed = false;
		const disposal = plugin.runtime.dispose().then(() => {
			disposed = true;
		});
		await until(() =>
			plugin.trace
				.snapshot()
				.logs.some((log) => log.text.includes("never cut short")),
		);
		expect(disposed).toBe(false);

		Deferred.doneUnsafe(gate, Effect.void);
		await disposal;
		// The batch wrote its file; only its submitter, a program on the
		// runtime, was interrupted.
		expect(vault.files()).toContain("Held.md");
		const interrupted = await inFlight;
		expect(interrupted !== undefined && Cause.hasInterrupts(interrupted)).toBe(
			true,
		);
	}, 30_000);

	it("waits on unload for a Librarian heal whose rename hangs, and logs that it waits", async () => {
		const vault = makeObsidianVault({
			[`${RAMEN}/Anchor-Ramen-Soup.md`]: "",
		});
		const plugin = makePlugin(vault, { slowShutdown: 20 });
		await plugin.launch((manager) =>
			Effect.succeed(launched(librarianOver(manager))),
		);
		const fileManager = vault.app.fileManager as unknown as {
			renameFile: (file: unknown, to: string) => Promise<void>;
		};
		const renameNow = fileManager.renameFile;
		const gate = Deferred.makeUnsafe<void>();
		const reached = Deferred.makeUnsafe<void>();
		fileManager.renameFile = (file, to) =>
			Effect.runPromise(
				Deferred.succeed(reached, undefined).pipe(
					Effect.andThen(Deferred.await(gate)),
				),
			).then(() => renameNow(file, to));
		await vault.createByHand(`${RAMEN}/Offline.md`);
		await Effect.runPromise(Deferred.await(reached));

		let disposed = false;
		const disposal = plugin.runtime.dispose().then(() => {
			disposed = true;
		});
		await until(() =>
			plugin.trace
				.snapshot()
				.logs.some((log) => log.text.includes("never cut short")),
		);
		expect(disposed).toBe(false);

		Deferred.doneUnsafe(gate, Effect.void);
		await disposal;
		expect(vault.files()).toContain(`${RAMEN}/Offline-Ramen-Soup.md`);
	}, 30_000);

	it("waits in whenIdle for a queued Librarian item and a Knowledge run", async () => {
		const plugin = makePlugin(
			makeObsidianVault({ [`${RAMEN}/Anchor-Ramen-Soup.md`]: "" }),
		);
		const vam = await plugin.launch((manager) =>
			Effect.succeed(launched(librarianOver(manager))),
		);
		const { runtime } = plugin;
		try {
			const idle = await runtime.e2e("idle", IdleTracker);
			const knowledgeGate = Deferred.makeUnsafe<void>();
			// The queue in a scope of the runtime's, as the Classify Layer holds it.
			const queue = await runtime.e2e(
				"knowledge-queue",
				Effect.flatMap(Scope.make(), (scope) =>
					Scope.provide(scope)(
						makeKnowledgeQueue({
							notify: () => {},
							run: () =>
								Deferred.await(knowledgeGate).pipe(
									Effect.as({ _tag: "Covered" } as never),
								),
						}),
					),
				),
			);
			await runtime.e2e("enqueue", queue.enqueue(knowledgeJob));
			// The Librarian heals a file made by hand, through its queue:
			// what is pending as it renames the file.
			const fileManager = plugin.vault.app.fileManager as unknown as {
				renameFile: (file: unknown, to: string) => Promise<void>;
			};
			const renameNow = fileManager.renameFile;
			const pendingAtRename: number[] = [];
			fileManager.renameFile = (file, to) => {
				const pending = runtime.readSync(idle.pending);
				if (Exit.isSuccess(pending)) pendingAtRename.push(pending.value);
				return renameNow(file, to);
			};
			await plugin.vault.createByHand(`${RAMEN}/Offline.md`);

			let idleNow = false;
			const whenIdle = runtime
				.e2e("when-idle", idle.whenIdle("50 millis"))
				.then(() => {
					idleNow = true;
				});
			await runtime.e2e("when-settled", vam.testing.whenSettled());
			expect(plugin.vault.files()).toContain(
				`${RAMEN}/Offline-Ramen-Soup.md`,
			);
			// The Knowledge run and the Librarian's queue item.
			expect(pendingAtRename).toEqual([2]);
			await new Promise((resolve) => setTimeout(resolve, 120));
			// The Librarian's item is done; the Knowledge run is not.
			expect(idleNow).toBe(false);
			expect(await runtime.e2e("pending", idle.pending)).toBe(1);

			Deferred.doneUnsafe(knowledgeGate, Effect.void);
			await whenIdle;
			expect(idleNow).toBe(true);
			expect(await runtime.e2e("running", queue.running)).toBe(0);
		} finally {
			await runtime.dispose();
		}
	}, 30_000);
});

const knowledgeJob: KnowledgeJob = {
	attestation: {} as Dumling.Attestation<"de">,
	label: "See 🌊",
	origin: "New",
	reading: {
		emojiDescription: "🌊",
		lemma: {
			canonicalForm: "See",
			coreFeatures: { gender: "Masc" },
			family: "Lexeme",
			kind: "NOUN",
			language: "de",
			unitKind: "Lemma",
		},
		unitKind: "Reading",
	} as unknown as Dumling.Reading<"de">,
	readingPath: "Worter/s/se/See.md",
	sentence: { segments: [{ text: "See" }], target: [0] },
};
