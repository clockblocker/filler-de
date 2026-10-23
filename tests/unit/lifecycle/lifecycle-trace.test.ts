import { describe, expect, it } from "bun:test";
import { makeRecentTrace } from "@textfresser/vault-action-manager/diagnostics";
import { Effect } from "effect";
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
						loadStore: () => Promise.resolve(),
						makeLibrarian: () => ({
							init: () =>
								Effect.void.pipe(Effect.withSpan("Fake.init")),
							unsubscribe: () => Effect.void,
						}),
						onLaunched: () => Effect.void,
						resetRunning: () => false,
						sweep: () => {},
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

	it("writes the recent trace out with a Librarian stop", () => {
		const written: string[] = [];
		const shown: string[] = [];
		const notices = createLifecycleNotices((message) => shown.push(message), {
			trace: { render: () => "TRACE" },
			writeStop: (text) => written.push(text),
		});
		notices.librarianStopped(
			{ kind: "Stopped", message: "Healing failed" },
			null,
		);
		notices.librarianStopped(
			{ kind: "LibraryRootMissing", message: "No Library folder" },
			"Settings",
		);

		expect(written).toEqual([
			"[TextEaterPlugin] The Librarian stopped: Healing failed\nTRACE",
		]);
		expect(shown).toEqual(["Healing failed", "No Library folder"]);
	});
});
