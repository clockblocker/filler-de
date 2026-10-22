import { describe, expect, it } from "bun:test";
import { makeRecentTrace } from "@textfresser/vault-action-manager/diagnostics";
import { Effect } from "effect";
import { createLifecycleNotices } from "../../../src/lifecycle/lifecycle-notices";
import {
	createLifecycleSupervisor,
	type SupervisedLibrarian,
} from "../../../src/lifecycle/lifecycle-supervisor";

describe("lifecycle trace", () => {
	it("records the spans of the lifecycle's commands", async () => {
		const trace = makeRecentTrace();
		const notices = createLifecycleNotices(() => {}, {
			trace,
			writeStop: () => {},
		});
		const supervisor = createLifecycleSupervisor<SupervisedLibrarian>({
			notices,
			tracer: trace.tracer,
		});

		await Effect.runPromise(
			supervisor.launch(
				Effect.succeed({
					attachLibrarian: () => () => {},
					loadStore: () => Promise.resolve(),
					makeLibrarian: () => ({
						init: () => Effect.void.pipe(Effect.withSpan("Fake.init")),
						unsubscribe: () => Effect.void,
					}),
					onLaunched: () => {},
					resetRunning: () => false,
					sweep: () => {},
				}),
			),
		);

		expect(trace.snapshot().spans.map(({ name }) => name)).toContain(
			"Fake.init",
		);
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
