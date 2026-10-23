import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { VaultActionManager } from "@textfresser/vault-action-manager";
import {
	makeRecentTrace,
	type RecentTrace,
	type RecordedLog,
	type RecordedSpan,
} from "@textfresser/vault-action-manager/diagnostics";
import { Cause, Effect } from "effect";
import type { App } from "obsidian";
import { Librarian } from "../../../src/commanders/librarian/librarian";
import { createLifecycleNotices } from "../../../src/lifecycle/lifecycle-notices";
import {
	Lifecycle,
	type LifecycleSupervisor,
} from "../../../src/lifecycle/lifecycle-supervisor";
import { makeObsidianVault } from "../../../src/packages/independent/vault-action-manager/tests/unit/helpers/obsidian-vault";
import { makeEdgeLog, ObservabilityLive } from "../../../src/runtime/observability";
import { PluginLive } from "../../../src/runtime/plugin-live";
import { makePluginRuntime } from "../../../src/runtime/plugin-runtime";
import { fakeHost } from "../../support/obsidian-host";
import {
	fixedSettings,
	memoryPluginData,
} from "../common-utils/test-settings";
import { unreachable } from "../dumgen/dumgen-support";

/** Lets every fiber and promise that can move, move. */
async function until(done: () => boolean): Promise<void> {
	for (let round = 0; round < 500 && !done(); round++)
		await new Promise((resolve) => setTimeout(resolve, 5));
	if (!done()) throw new Error("timed out");
}

/** `span` and its ancestors' names, innermost first. */
function ancestry(
	spans: readonly RecordedSpan[],
	spanId: string | undefined,
): string[] {
	const names: string[] = [];
	let current = spans.find((span) => span.spanId === spanId);
	while (current) {
		names.push(current.name);
		const parentId: string | undefined = current.parentId;
		current = spans.find((span) => span.spanId === parentId);
	}
	return names;
}

const logsMatching = (trace: RecentTrace, text: string): RecordedLog[] =>
	trace.snapshot().logs.filter((log) => log.text.includes(text));

describe("Plugin logging", () => {
	let warn: ReturnType<typeof spyOn>;
	beforeEach(() => {
		warn = spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => {
		warn.mockRestore();
	});

	it("logs a Librarian heal's warning under the heal's span, in the trace and the console", async () => {
		const trace = makeRecentTrace();
		const vault = makeObsidianVault({
			"Library/Soup/Anchor-Soup.md": "",
		});
		let lifecycle: LifecycleSupervisor<Librarian> | null = null;
		const runtime = makePluginRuntime(
			PluginLive(vault.app as unknown as App, {
				confirm: () => Promise.resolve(true),
				data: memoryPluginData(),
				host: fakeHost().layer,
				notices: createLifecycleNotices(() => {}, {
					trace,
					writeStop: () => {},
				}),
				requestUrl: unreachable,
				trace,
			}),
			{
				onBuildFailed: (cause) => {
					throw new Error(Cause.pretty(cause));
				},
			},
		);
		try {
			runtime.onload(
				Effect.gen(function* () {
					const vam = yield* VaultActionManager;
					lifecycle = yield* Lifecycle;
					yield* lifecycle.launch(
						Effect.gen(function* () {
							yield* vam.startListening();
							return {
								attachLibrarian: () => () => {},
								loadStore: Effect.void,
								makeLibrarian: (onStopped) =>
									Librarian.make(vam, { onStopped, settings: fixedSettings() }),
								onLaunched: () => Effect.void,
								resetRunning: () => false,
								sweep: Effect.void,
							};
						}),
					);
				}),
			);
			await until(
				() => lifecycle?.librarianState().kind === "Running",
			);
			const vam = await runtime.e2e(
				"vam",
				Effect.service(VaultActionManager),
			);

			// Its suffix has an empty Section name: the Librarian cannot
			// heal it, and says so.
			await vault.createByHand("Library/Soup/Ramen--Soup.md");
			await runtime.e2e("when-settled", vam.testing.whenSettled());

			const [logged, ...others] = logsMatching(
				trace,
				"Invalid live Create observation",
			);
			expect(others).toEqual([]);
			expect(logged?.level).toBe("WARN");
			expect(logged?.text).toContain("Ramen--Soup");
			const { spans } = trace.snapshot();
			const heal = ancestry(spans, logged?.spanId);
			expect(heal[0]).toBe("Librarian.processQueueItem");
			expect(heal).toEqual(
				expect.arrayContaining([
					"Librarian.handleBulkEvent",
					"vam.observation.deliver",
				]),
			);
			expect(warn).toHaveBeenCalledWith(
				"[Librarian] Invalid live Create observation",
				expect.objectContaining({ span: "Librarian.processQueueItem" }),
			);
		} finally {
			await runtime.dispose();
		}
	}, 30_000);

	it("logs at an edge through the plugin's loggers, before a runtime and after one", async () => {
		const trace = makeRecentTrace();
		const logAtEdge = makeEdgeLog(trace);
		logAtEdge("Warn", "[Edge] before", { path: "Library/Soup.md" });

		const runtime = makePluginRuntime(ObservabilityLive(trace), {
			onBuildFailed: () => {},
		});
		await runtime.command("noop", Effect.void);
		await runtime.dispose();
		const info = spyOn(console, "info").mockImplementation(() => {});
		try {
			logAtEdge("Info", "[Edge] after");
			expect(info).toHaveBeenCalledWith("[Edge] after");
		} finally {
			info.mockRestore();
		}

		expect(warn).toHaveBeenCalledWith("[Edge] before", {
			path: "Library/Soup.md",
		});
		const logs = trace.snapshot().logs;
		expect(
			logs.map(({ level, spanId, text }) => ({ level, spanId, text })),
		).toEqual([
			{
				level: "WARN",
				spanId: undefined,
				text: '[Edge] before {"path":"Library/Soup.md"}',
			},
			{ level: "INFO", spanId: undefined, text: "[Edge] after" },
		]);
	});

	it("keeps note content out of the trace, in values and in annotations", async () => {
		const trace = makeRecentTrace();
		const runtime = makePluginRuntime(ObservabilityLive(trace), {
			onBuildFailed: () => {},
		});
		const secret = "Ich bin ein geheimer Satz.";
		await runtime.command(
			"log",
			Effect.logWarning("[Test] wrote", { content: secret, path: "A.md" }).pipe(
				Effect.annotateLogs({ markdown: secret, path: "A.md" }),
			),
		);
		await runtime.dispose();

		const [logged] = logsMatching(trace, "[Test] wrote");
		expect(logged?.text).not.toContain(secret);
		expect(logged?.text).toContain(`<${secret.length} chars>`);
		expect(logged?.text).toContain("path=");
	});
});
