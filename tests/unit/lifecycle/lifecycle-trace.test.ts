import { describe, expect, it } from "bun:test";
import { VamScanError } from "@textfresser/vault-action-manager";
import { makeRecentTrace } from "@textfresser/vault-action-manager/diagnostics";
import { Cause, Deferred, Effect } from "effect";
import {
	LibrarianStopped,
	LibraryRootMissing,
} from "../../../src/commanders/librarian/librarian";
import { createLifecycleNotices } from "../../../src/lifecycle/lifecycle-notices";
import {
	createLifecycleSupervisor,
	type SupervisedLibrarian,
} from "../../../src/lifecycle/lifecycle-supervisor";

describe("lifecycle trace", () => {
	it("runs each command under the tracer and span of the fiber that submitted it", async () => {
		const trace = makeRecentTrace();
		const notices = createLifecycleNotices(() => {}, {
			trace,
			writeStop: () => {},
		});
		const supervisor = createLifecycleSupervisor<SupervisedLibrarian>({
			notices,
		});

		await Effect.runPromise(
			supervisor
				.launch(
					Effect.succeed({
						attachLibrarian: () => () => {},
						loadStore: Effect.void,
						makeLibrarian: () => ({
							init: () =>
								Effect.void.pipe(Effect.withSpan("Fake.init")),
							unsubscribe: () => Effect.void,
						}),
						onLaunched: () => Effect.void,
						resetRunning: () => false,
						sweep: Effect.void,
					}),
				)
				.pipe(
					Effect.withSpan("command.launch"),
					Effect.withTracer(trace.tracer),
				),
		);

		const { spans } = trace.snapshot();
		const byId = new Map(spans.map((span) => [span.spanId, span]));
		const ancestry = (name: string) => {
			const names: string[] = [];
			let span = spans.find((candidate) => candidate.name === name);
			while (span) {
				names.push(span.name);
				span =
					span.parentId === undefined
						? undefined
						: byId.get(span.parentId);
			}
			return names;
		};
		expect(ancestry("Fake.init")).toEqual([
			"Fake.init",
			"Lifecycle.Launch",
			"command.launch",
		]);
		await Effect.runPromise(supervisor.stop);
	});

	it("runs reconfigures that waited together once, linked to each request's span", async () => {
		const trace = makeRecentTrace();
		const supervisor = createLifecycleSupervisor<SupervisedLibrarian>({
			notices: createLifecycleNotices(() => {}, {
				trace,
				writeStop: () => {},
			}),
		});
		const ready = Deferred.makeUnsafe<void>();
		const traced = <A, E>(name: string, effect: Effect.Effect<A, E>) =>
			Effect.runPromise(
				effect.pipe(Effect.withSpan(name), Effect.withTracer(trace.tracer)),
			);
		const launch = traced(
			"obsidian.onload",
			supervisor.launch(
				Deferred.await(ready).pipe(
					Effect.as({
						attachLibrarian: () => () => {},
						loadStore: Effect.void,
						makeLibrarian: () => ({
							init: () => Effect.void,
							unsubscribe: () => Effect.void,
						}),
						onLaunched: () => Effect.void,
						resetRunning: () => false,
						sweep: Effect.void,
					}),
				),
			),
		);
		const first = traced("settings.first", supervisor.reconfigure);
		const second = traced("settings.second", supervisor.reconfigure);
		Deferred.doneUnsafe(ready, Effect.void);
		await launch;
		expect(await first).toBe(true);
		expect(await second).toBe(true);

		const { spans } = trace.snapshot();
		const named = (name: string) =>
			spans.filter((span) => span.name === name);
		const [reconfigure, ...others] = named("Lifecycle.Reconfigure");
		expect(others).toHaveLength(0);
		expect(reconfigure?.parentId).toBe(named("settings.first")[0]?.spanId);
		expect(reconfigure?.linkIds).toEqual([
			named("settings.second")[0]?.spanId ?? "missing",
		]);
		await Effect.runPromise(supervisor.stop);
	});

	it("writes the recent trace out with a Librarian stop", () => {
		const written: string[] = [];
		const shown: string[] = [];
		const notices = createLifecycleNotices((message) => shown.push(message), {
			trace: { render: () => "TRACE" },
			writeStop: (text) => written.push(text),
		});
		notices.librarianStopped(
			new LibrarianStopped({
				cause: Cause.empty,
				message: "Healing failed",
				phase: "Runtime",
			}),
			null,
		);
		notices.librarianStopped(
			new LibraryRootMissing({
				cause: new VamScanError({
					cause: new Error("Folder not found: Library"),
					operation: "scanRoot",
					path: "Library",
				}),
				message: "No Library folder",
			}),
			"Settings",
		);

		expect(written).toEqual([
			"[TextEaterPlugin] The Librarian stopped: Healing failed\nTRACE",
		]);
		expect(shown).toEqual(["Healing failed", "No Library folder"]);
	});
});
