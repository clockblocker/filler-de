import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { VamScanError } from "@textfresser/vault-action-manager";
import { makeRecentTrace } from "@textfresser/vault-action-manager/diagnostics";
import { Cause, Effect, Exit, Logger, Option } from "effect";
import {
	Librarian,
	type LibrarianStop,
	LibrarianStopped,
} from "../../../src/commanders/librarian/librarian";
import { createLifecycleNotices } from "../../../src/lifecycle/lifecycle-notices";
import {
	createLifecycleSupervisor,
	LibrarianStartFailed,
} from "../../../src/lifecycle/lifecycle-supervisor";
import { withScanAndSubscribe } from "../../support/librarian-vam";
import { setupGetParsedUserSettingsSpy } from "../common-utils/setup-spy";

let settingsSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	settingsSpy = setupGetParsedUserSettingsSpy();
});

afterEach(() => {
	settingsSpy.mockRestore();
});

/**
 * A vault whose scan of the Library fails, and whose scan then throws as
 * it cleans up: a startup that fails for two reasons.
 */
function twoReasonVam() {
	return withScanAndSubscribe({
		cd: () => Effect.void,
		dispatch: () => Effect.void,
		getActiveEditorContext: () => Effect.succeed(null),
		getOpenedContent: () => Effect.succeed(""),
		mdPwd: () => Effect.succeed(null),
		scan: () =>
			Effect.fail(
				new VamScanError({
					cause: new Error("permission denied"),
					operation: "scanFolder",
					path: "Library/Soup",
				}),
			).pipe(
				Effect.ensuring(Effect.die(new Error("the scan's finalizer exploded"))),
			),
		subscribeToBulk: () => Effect.succeed({ close: Effect.void }),
	});
}

describe("a Librarian startup that fails for two reasons", () => {
	it("stops with both, in its typed stop, the stop notice and the recent trace", async () => {
		const trace = makeRecentTrace();
		const stops: LibrarianStop[] = [];
		const librarian = new Librarian(twoReasonVam(), {
			onStopped: (stop) => stops.push(stop),
		});

		const exit = await Effect.runPromiseExit(
			librarian.init().pipe(Effect.provide(Logger.layer([trace.logger]))),
		);

		expect(Exit.isFailure(exit)).toBeTrue();
		if (!Exit.isFailure(exit)) return;
		const stop = Option.getOrUndefined(Cause.findErrorOption(exit.cause));
		expect(stop).toBeInstanceOf(LibrarianStopped);
		expect(stops).toEqual(stop ? [stop] : []);
		if (!(stop instanceof LibrarianStopped)) return;

		// The typed stop keeps every reason.
		expect(stop.cause.reasons.filter(Cause.isFailReason)).toHaveLength(1);
		expect(stop.cause.reasons.filter(Cause.isDieReason)).toHaveLength(1);

		// The notice names the file and the defect.
		expect(stop.message).toContain(
			"The Librarian stopped: it could not heal the library at startup.",
		);
		expect(stop.message).toContain(
			"Failed: Library/Soup (permission denied).",
		);
		expect(stop.message).toContain(
			"Also: the scan's finalizer exploded.",
		);

		// The trace logs the stop with its whole cause.
		const rendered = trace.render();
		expect(rendered).toContain("[Librarian] Stopped.");
		expect(rendered).toContain("permission denied");
		expect(rendered).toContain("Defect: Error: the scan's finalizer exploded");
	});

	it("shows both in the sticky notice, and the lifecycle's log keeps both", async () => {
		const trace = makeRecentTrace();
		const shown: { message: string; sticky: boolean }[] = [];
		const notices = createLifecycleNotices(
			(message, { sticky }) => shown.push({ message, sticky }),
			{ trace, writeStop: () => {} },
		);
		const supervisor = createLifecycleSupervisor<Librarian>({ notices });
		const vam = twoReasonVam();

		await Effect.runPromise(
			supervisor
				.launch(
					Effect.succeed({
						attachLibrarian: () => () => undefined,
						loadStore: Effect.void,
						makeLibrarian: (onStopped) =>
							new Librarian(vam, { onStopped }),
						onLaunched: () => Effect.void,
						resetRunning: () => false,
						sweep: () => undefined,
					}),
				)
				.pipe(Effect.provide(Logger.layer([trace.logger]))),
		);

		expect(supervisor.state().kind).toBe("Running");
		const state = supervisor.librarianState();
		expect(state.kind).toBe("Failed");
		if (state.kind === "Failed")
			expect(state.cause).toBeInstanceOf(LibrarianStartFailed);
		expect(shown).toHaveLength(1);
		expect(shown[0]?.sticky).toBeTrue();
		expect(shown[0]?.message).toContain("Library/Soup (permission denied)");
		expect(shown[0]?.message).toContain("the scan's finalizer exploded");

		const rendered = trace.render();
		const startFailed = rendered
			.split("\n")
			.findIndex((line) =>
				line.includes("Failed to initialize librarian"),
			);
		expect(startFailed).toBeGreaterThanOrEqual(0);
		const logged = rendered.split("\n").slice(startFailed).join("\n");
		expect(logged).toContain("LibrarianStartFailed");
		expect(logged).toContain("permission denied");
		expect(logged).toContain("Defect: Error: the scan's finalizer exploded");
		await Effect.runPromise(supervisor.stop);
	});
});
