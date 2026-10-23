import { afterEach, beforeEach, describe, expect, it, type spyOn } from "bun:test";
import { VaultActionManager } from "@textfresser/vault-action-manager";
import {
	makeRecentTrace,
	type RecentTrace,
	type RecordedSpan,
} from "@textfresser/vault-action-manager/diagnostics";
import { Cause, Effect, Exit, Layer } from "effect";
import type { App } from "obsidian";
import { Librarian } from "../../../src/commanders/librarian/librarian";
import { createLifecycleNotices } from "../../../src/lifecycle/lifecycle-notices";
import {
	createLifecycleSupervisor,
	type LaunchedPlugin,
	type SupervisedLibrarian,
} from "../../../src/lifecycle/lifecycle-supervisor";
import { makeObsidianVault } from "../../../src/packages/independent/vault-action-manager/tests/unit/helpers/obsidian-vault";
import { ObservabilityLive } from "../../../src/runtime/observability";
import { PluginLive } from "../../../src/runtime/plugin-live";
import {
	makePluginRuntime,
	PluginEdgeError,
} from "../../../src/runtime/plugin-runtime";
import { setupGetParsedUserSettingsSpy } from "../common-utils/setup-spy";
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
	let settingsSpy: ReturnType<typeof spyOn>;
	beforeEach(() => {
		settingsSpy = setupGetParsedUserSettingsSpy();
	});
	afterEach(() => {
		settingsSpy.mockRestore();
	});

	/** The plugin runtime over an in-memory vault, with its own trace. */
	function makePlugin<L extends SupervisedLibrarian>(
		initial: Record<string, string>,
	) {
		const trace = makeRecentTrace();
		const vault = makeObsidianVault(initial);
		const lifecycle = createLifecycleSupervisor<L>({
			notices: createLifecycleNotices(() => {}, {
				trace,
				writeStop: () => {},
			}),
		});
		const runtime = makePluginRuntime(
			PluginLive(vault.app as unknown as App, {
				lifecycle,
				providerKeys: () => ({ openaiApiKey: "", typesafeApiKey: "" }),
				requestUrl: unreachable,
				trace,
			}),
			{
				onBuildFailed: (cause) => {
					throw new Error(Cause.pretty(cause));
				},
			},
		);
		/** Launches as `onload` does, with `wire` building the services. */
		const launch = async (
			wire: (
				vam: VaultActionManager,
			) => Effect.Effect<LaunchedPlugin<L>, unknown>,
		) => {
			runtime.onload(
				Effect.gen(function* () {
					const vam = yield* VaultActionManager;
					yield* lifecycle.launch(
						Effect.gen(function* () {
							yield* vam.startListening();
							return yield* wire(vam);
						}),
					);
				}),
			);
			await until(() => lifecycle.state().kind === "Running");
			return runtime.e2e("vam", Effect.service(VaultActionManager));
		};
		return { launch, lifecycle, runtime, trace, vault };
	}

	const launched = <L extends SupervisedLibrarian>(
		makeLibrarian: LaunchedPlugin<L>["makeLibrarian"],
	): LaunchedPlugin<L> => ({
		attachLibrarian: () => () => {},
		loadStore: () => Promise.resolve(),
		makeLibrarian,
		onLaunched: () => Effect.void,
		resetRunning: () => false,
		sweep: () => {},
	});

	it("shows a Librarian restart as one tree: the command, the Librarian's start, VAM's scan and dispatch", async () => {
		const plugin = makePlugin<Librarian>({
			[`${RAMEN}/Anchor-Ramen-Soup.md`]: "",
		});
		const vam = await plugin.launch((manager) =>
			Effect.succeed(
				launched(
					(onStopped) => new Librarian(manager, { onStopped }),
				),
			),
		);
		try {
			expect(plugin.lifecycle.librarianState().kind).toBe("Running");
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
				plugin.lifecycle.pause("DelimiterMigration"),
			);
			await plugin.vault.createByHand(`${RAMEN}/Offline.md`);
			await plugin.runtime.command(
				"restart-librarian",
				plugin.lifecycle.restart,
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

	it("disposes newest first: the owned services, then the Librarian, then VAM", async () => {
		const released: string[] = [];
		const plugin = makePlugin<SupervisedLibrarian>({});
		/** Records `what`, and whether VAM still answered then. */
		const record = (vam: VaultActionManager, what: string) =>
			Effect.exit(vam.mdPwd()).pipe(
				Effect.map((exit) => {
					released.push(`${what}: VAM ${Exit.isSuccess(exit) ? "up" : "down"}`);
				}),
			);
		const vam = await plugin.launch((manager) =>
			Effect.gen(function* () {
				yield* plugin.lifecycle.own("close the store", record(manager, "store"));
				yield* plugin.lifecycle.own(
					"close the observer",
					record(manager, "observer"),
				);
				return launched<SupervisedLibrarian>(() => ({
					init: () => Effect.void,
					unsubscribe: () => record(manager, "librarian"),
				}));
			}),
		);

		await plugin.runtime.dispose();

		expect(released).toEqual([
			"observer: VAM up",
			"store: VAM up",
			"librarian: VAM up",
		]);
		const read = await Effect.runPromiseExit(vam.mdPwd());
		expect(Exit.isFailure(read)).toBe(true);
		expect(plugin.lifecycle.state().kind).toBe("Stopped");
		const shutdown = only(plugin.trace, "vam.shutdown");
		expect(shutdown.status).toBe("ok");
	}, 30_000);
});
