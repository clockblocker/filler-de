import { afterEach, describe, expect, it } from "bun:test";
import { Clock, Effect, Exit, Layer } from "effect";
import { type TAbstractFile, TFile, TFolder } from "obsidian";
import type { VamSetupError } from "../../src/effect/errors";
import { type VamLiveServices, VaultIo } from "../../src/effect/ports";
import { createVamRuntime, type VamRuntime } from "../../src/effect/runtime";
import { DispatchBatchCoordinator } from "../../src/impl/actions-processing/dispatch-batch";
import type { Executor } from "../../src/impl/actions-processing/executor";
import { SelfEventTracker } from "../../src/impl/event-processing/self-event-tracker";
import { MD } from "../../src/types/literals";
import type { SplitPathToMdFile } from "../../src/types/split-path";
import type { VaultAction } from "../../src/types/vault-action";
import { VaultActionKind } from "../../src/types/vault-action";

const TTL_MS = 5000;

const mdFile = (basename: string): SplitPathToMdFile => ({
	basename,
	extension: MD,
	kind: "MdFile",
	pathParts: ["Library"],
});

const rename = (from: string, to: string): VaultAction => ({
	kind: VaultActionKind.RenameMdFile,
	payload: { from: mdFile(from), to: mdFile(to) },
});

const pathOf = (basename: string) => `Library/${basename}.md`;

function makeEntry(path: string): TAbstractFile {
	if (!path.endsWith(".md")) {
		const folder = new TFolder();
		folder.path = path;
		folder.children = [];
		return folder;
	}
	const file = new TFile();
	file.path = path;
	return file;
}

/**
 * A wall clock the test moves by hand. Sleeping is delegated to the real
 * clock so nothing in the worker spins; only the time Self Event expirations
 * are measured against is controlled.
 */
function manualClock(real: Clock.Clock) {
	let now = 1_000_000;
	const clock: Clock.Clock = {
		currentTimeMillis: Effect.sync(() => now),
		currentTimeMillisUnsafe: () => now,
		currentTimeNanos: Effect.sync(() => BigInt(now) * 1_000_000n),
		currentTimeNanosUnsafe: () => BigInt(now) * 1_000_000n,
		monotonicTimeNanos: real.monotonicTimeNanos,
		monotonicTimeNanosUnsafe: () => real.monotonicTimeNanosUnsafe(),
		sleep: (duration) => real.sleep(duration),
	};
	return {
		advance: (ms: number) => {
			now += ms;
		},
		clock,
	};
}

const runtimes: VamRuntime[] = [];
const coordinators: DispatchBatchCoordinator[] = [];

afterEach(async () => {
	for (const [index, coordinator] of coordinators.splice(0).entries()) {
		const runtime = runtimes[index];
		await runtime?.runPromiseExit(coordinator.shutdownEffect());
	}
	for (const runtime of runtimes.splice(0)) await runtime.dispose();
});

/**
 * Wires a real SelfEventTracker into a real Dispatch Batch worker over a fake
 * vault. Each executed action takes `actionMs` of wall time and then fires
 * the Obsidian events it causes, consulting the tracker the way Vault
 * Observation does. `probe` names a path a user touches while the action
 * runs; whether it was treated as Self is recorded in `probed`.
 */
function setup(
	actionMs: number,
	options: {
		readonly probe?: (action: VaultAction) => string | undefined;
		readonly reportsEvents?: boolean;
	} = {},
) {
	const real = Effect.runSync(Clock.clockWith(Effect.succeed));
	const time = manualClock(real);
	const vault = VaultIo.of({
		create: () => Effect.die("not used"),
		createFolder: () => Effect.die("not used"),
		getAbstractFileByPath: (path) => Effect.succeed(makeEntry(path)),
		getMarkdownFiles: Effect.die("not used"),
		modify: () => Effect.die("not used"),
		process: () => Effect.die("not used"),
		read: () => Effect.die("not used"),
		rename: () => Effect.die("not used"),
		resolveLinkpathDest: () => Effect.die("not used"),
		stat: () => Effect.die("not used"),
		trash: () => Effect.die("not used"),
	});
	const layer = Layer.mergeAll(
		Layer.succeed(VaultIo, vault),
		Layer.succeed(Clock.Clock, time.clock),
	) as unknown as Layer.Layer<VamLiveServices, VamSetupError>;
	const runtime = createVamRuntime(layer);
	runtimes.push(runtime);

	const trackerExit = runtime.runSyncExit(
		SelfEventTracker.makeEffect({ ttlMs: TTL_MS }),
	);
	if (Exit.isFailure(trackerExit)) throw new Error("tracker setup failed");
	const tracker = trackerExit.value;

	/** Per renamed note: whether each side of its rename event was Self. */
	const attributed: { from: boolean; path: string; to: boolean }[] = [];
	const probed: { path: string; self: boolean }[] = [];
	const executor = {
		execute: (action: VaultAction) =>
			Effect.gen(function* () {
				if (action.kind !== VaultActionKind.RenameMdFile) return;
				const probe = options.probe?.(action);
				if (probe !== undefined) {
					probed.push({
						path: probe,
						self: yield* tracker.shouldIgnoreEffect(probe),
					});
				}
				time.advance(actionMs);
				if (options.reportsEvents === false) return;
				const to = pathOf(action.payload.to.basename);
				const from = pathOf(action.payload.from.basename);
				attributed.push({
					from: yield* tracker.shouldIgnoreEffect(from),
					path: to,
					to: yield* tracker.shouldIgnoreEffect(to),
				});
			}),
	} as unknown as Executor;

	const coordinator = new DispatchBatchCoordinator(
		executor,
		tracker,
		runtime,
	);
	coordinators.push(coordinator);

	return {
		advance: time.advance,
		attributed,
		dispatch: (actions: readonly VaultAction[]) =>
			runtime.runPromiseExit(coordinator.dispatchEffect(actions)),
		probed,
		shouldIgnore: async (path: string) => {
			const exit = await runtime.runPromiseExit(
				tracker.shouldIgnoreEffect(path),
			);
			if (Exit.isFailure(exit)) throw new Error("shouldIgnore failed");
			return exit.value;
		},
	};
}

describe("Self Event deadline across a long Dispatch Batch", () => {
	it("attributes the events of actions that finish more than the TTL after the batch starts", async () => {
		const harness = setup(2000);
		const actions = Array.from({ length: 6 }, (_, index) =>
			rename(`old-${index}`, `new-${index}`),
		);

		const result = await harness.dispatch(actions);

		expect(Exit.isSuccess(result)).toBe(true);
		// The batch runs for 12 s; every rename event must still be Self.
		expect(harness.attributed).toEqual(
			actions.map((_, index) => ({
				from: true,
				path: pathOf(`new-${index}`),
				to: true,
			})),
		);
	});

	it("attributes the events of a single action that runs longer than the TTL", async () => {
		const harness = setup(TTL_MS + 1000);

		const result = await harness.dispatch([rename("slow-old", "slow-new")]);

		expect(Exit.isSuccess(result)).toBe(true);
		expect(harness.attributed).toEqual([
			{ from: true, path: pathOf("slow-new"), to: true },
		]);
	});

	it("ends an unmatched Self Event window one TTL after its action completes", async () => {
		// Obsidian never reports this rename, so both entries stay unmatched.
		const harness = setup(TTL_MS + 1000, { reportsEvents: false });
		const result = await harness.dispatch([
			rename("quiet-old", "quiet-new"),
		]);
		expect(Exit.isSuccess(result)).toBe(true);

		harness.advance(TTL_MS - 1);
		expect(await harness.shouldIgnore(pathOf("quiet-new"))).toBe(true);
		harness.advance(1);
		expect(await harness.shouldIgnore(pathOf("quiet-old"))).toBe(false);
	});

	it("does not treat a later action's path as Self before that action runs", async () => {
		const first = rename("first-old", "first-new");
		const second = rename("second-old", "second-new");
		const harness = setup(10, {
			probe: (action) =>
				action === first ? pathOf("second-old") : undefined,
		});

		const result = await harness.dispatch([first, second]);

		expect(Exit.isSuccess(result)).toBe(true);
		// A user edit to the second note while the first rename runs is real.
		expect(harness.probed).toEqual([
			{ path: pathOf("second-old"), self: false },
		]);
	});
});
