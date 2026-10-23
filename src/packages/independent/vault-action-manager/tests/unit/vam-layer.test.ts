/**
 * `VaultActionManager.layer` on a host's runtime: VAM brings no runtime of
 * its own, its spans land in the host's trace under the host's spans, and
 * closing the host's scope stops its worker and its observation.
 */
import { describe, expect, it } from "bun:test";
import {
	type BulkVaultEvent,
	createVaultActionManager,
	type SplitPathToMdFile,
	splitPathCodec,
	VamDispatchFailure,
	VamSetupError,
	VamShutdownError,
	type VaultAction,
	VaultActionKind,
	VaultActionManager,
} from "@textfresser/vault-action-manager";
import {
	makeRecentTrace,
	type RecordedSpan,
} from "@textfresser/vault-action-manager/diagnostics";
import {
	Cause,
	Effect,
	Exit,
	Layer,
	ManagedRuntime,
	Option,
	Tracer,
} from "effect";
import type { App } from "obsidian";
import { makeObsidianVault } from "./helpers/obsidian-vault";

const md = (path: string) => splitPathCodec.parse(path) as SplitPathToMdFile;

const create = (path: string, content: string): VaultAction => ({
	kind: VaultActionKind.CreateMdFile,
	payload: { content, splitPath: md(path) },
});

/** The vault with its live listeners counted, and `create` held at a gate. */
function heldVault() {
	const vault = makeObsidianVault({ "Library/a.md": "a" });
	const obsidian = vault.app.vault as unknown as {
		create: (path: string, content: string) => Promise<unknown>;
		offref: (ref: unknown) => void;
		on: (name: string, callback: unknown) => unknown;
	};
	let listeners = 0;
	const { create: createNow, offref, on } = obsidian;
	obsidian.on = (name, callback) => {
		listeners++;
		return on(name, callback);
	};
	obsidian.offref = (ref) => {
		listeners--;
		offref(ref);
	};
	let held = false;
	let release = () => {};
	let reached = () => {};
	const reachedGate = new Promise<void>((resolve) => {
		reached = resolve;
	});
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	obsidian.create = async (path, content) => {
		if (held) {
			reached();
			await gate;
		}
		return createNow(path, content);
	};
	return {
		...vault,
		hold: () => {
			held = true;
		},
		listeners: () => listeners,
		reachedGate,
		release,
	};
}

function ancestors(
	span: RecordedSpan,
	spans: readonly RecordedSpan[],
): string[] {
	const byId = new Map(spans.map((each) => [each.spanId, each]));
	const names: string[] = [];
	for (
		let parent = span.parentId ? byId.get(span.parentId) : undefined;
		parent;
		parent = parent.parentId ? byId.get(parent.parentId) : undefined
	)
		names.push(parent.name);
	return names;
}

function typedFailure<E>(exit: Exit.Exit<unknown, E>): E | undefined {
	return Exit.isFailure(exit)
		? Option.getOrUndefined(Cause.findErrorOption(exit.cause))
		: undefined;
}

describe("VaultActionManager.layer", () => {
	it("runs on the host's runtime, with VAM's spans under the host's span in the host's tracer", async () => {
		const vault = makeObsidianVault({ "Library/a.md": "a" });
		const trace = makeRecentTrace();
		const runtime = ManagedRuntime.make(
			VaultActionManager.layer(vault.app, {
				observability: "host",
			}).pipe(
				Layer.provideMerge(Layer.succeed(Tracer.Tracer, trace.tracer)),
			),
		);
		const delivered: BulkVaultEvent[] = [];
		try {
			await runtime.runPromise(
				Effect.gen(function* () {
					const vam = yield* VaultActionManager;
					yield* vam.startListening();
					yield* vam.subscribeToBulk(
						(event) => Effect.sync(() => delivered.push(event)),
						{ from: "all" },
					);
					yield* vam.dispatch([create("Library/b.md", "b")], {
						caller: "host",
					});
					yield* vam.testing.whenSettled();
				}).pipe(Effect.withSpan("host.command")),
			);
		} finally {
			await runtime.dispose();
		}

		expect(vault.content("Library/b.md")).toBe("b");
		expect(delivered).toHaveLength(1);
		const { spans } = trace.snapshot();
		const named = (name: string) => {
			const found = spans.filter((span) => span.name === name);
			expect(found.length).toBeGreaterThan(0);
			return found;
		};
		const [host] = named("host.command");
		const [dispatch] = named("vam.dispatch");
		expect(dispatch?.parentId).toBe(host?.spanId);
		// The batch runs on the worker the Layer forked, under the dispatch.
		const [batch] = named("DispatchBatch.executeBatch");
		if (!batch) throw new Error("no batch span");
		expect(ancestors(batch, spans)).toEqual(
			expect.arrayContaining(["vam.dispatch", "host.command"]),
		);
		// The delivery runs on the host's tracer too.
		named("vam.observation.deliver");
		// A vault callback is no part of the build that made its channel.
		for (const span of named("SelfEventTracker.attribute"))
			expect(ancestors(span, spans)).not.toContain(
				"VaultObservation.makeEffect",
			);
	});

	it("runs each batch with its submitter's tracer, even beside a merged tracer", async () => {
		const vault = makeObsidianVault({ "Library/a.md": "a" });
		const trace = makeRecentTrace();
		const runtime = ManagedRuntime.make(
			Layer.merge(
				VaultActionManager.layer(vault.app, { observability: "host" }),
				Layer.succeed(Tracer.Tracer, trace.tracer),
			),
		);
		try {
			await runtime.runPromise(
				VaultActionManager.use((vam) =>
					vam.dispatch([create("Library/b.md", "b")], {
						caller: "host",
					}),
				).pipe(Effect.withSpan("host.command")),
			);
		} finally {
			await runtime.dispose();
		}
		const names = trace.snapshot().spans.map((span) => span.name);
		expect(names).toContain("vam.dispatch");
		expect(names).toContain("DispatchBatch.executeBatch");
	});

	it("installs its own tracer only when asked to", async () => {
		const host = makeRecentTrace();
		const own = makeRecentTrace();
		const run = async (layer: Layer.Layer<VaultActionManager, unknown>) => {
			const runtime = ManagedRuntime.make(
				layer.pipe(
					Layer.provideMerge(
						Layer.succeed(Tracer.Tracer, host.tracer),
					),
				),
			);
			try {
				await runtime.runPromise(
					VaultActionManager.use((vam) =>
						vam.dispatch([create("Library/b.md", "b")], {
							caller: "host",
						}),
					).pipe(Effect.withSpan("host.command")),
				);
			} finally {
				await runtime.dispose();
			}
		};
		const names = (trace: typeof host) =>
			trace.snapshot().spans.map((span) => span.name);

		await run(
			VaultActionManager.layer(makeObsidianVault({}).app, {
				recentTrace: own,
			}),
		);
		expect(names(own)).toContain("vam.dispatch");
		expect(names(own)).toContain("DispatchBatch.executeBatch");
		expect(names(host)).not.toContain("vam.dispatch");
	});

	it("stops its worker and its observation when the host's scope closes mid-dispatch", async () => {
		const vault = heldVault();
		const runtime = ManagedRuntime.make(
			VaultActionManager.layer(vault.app, { observability: "host" }),
		);
		const vam = await runtime.runPromise(
			Effect.service(VaultActionManager),
		);
		const delivered: BulkVaultEvent[] = [];
		await runtime.runPromise(
			Effect.gen(function* () {
				yield* vam.startListening();
				yield* vam.subscribeToBulk((event) =>
					Effect.sync(() => delivered.push(event)),
				);
			}),
		);
		expect(vault.listeners()).toBe(3);
		await vault.createByHand("Library/by-hand.md");
		await runtime.runPromise(vam.testing.whenSettled());
		expect(delivered).toHaveLength(1);

		vault.hold();
		const inFlight = runtime.runPromiseExit(
			vam.dispatch([create("Library/b.md", "b")], { caller: "host" }),
		);
		await vault.reachedGate;

		let disposed = false;
		const disposing = runtime.dispose().then(() => {
			disposed = true;
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		// The active batch finishes before the manager is gone.
		expect(disposed).toBe(false);

		const late = await Effect.runPromiseExit(
			vam.dispatch([create("Library/c.md", "c")], { caller: "host" }),
		);
		const lateFailure = typedFailure(late);
		expect(lateFailure).toBeInstanceOf(VamDispatchFailure);
		expect((lateFailure as VamDispatchFailure).reason).toBeInstanceOf(
			VamShutdownError,
		);

		vault.release();
		await disposing;
		expect(disposed).toBe(true);
		// The host interrupts its own caller; the batch it queued still ran.
		expect(Exit.isFailure(await inFlight)).toBe(true);
		expect(vault.content("Library/b.md")).toBe("b");
		expect(vault.content("Library/c.md")).toBeUndefined();

		// Observation stopped: its listeners are released, and nothing more
		// is delivered.
		expect(vault.listeners()).toBe(0);
		await vault.createByHand("Library/after.md");
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(delivered).toHaveLength(1);
		expect(
			typedFailure(
				await Effect.runPromiseExit(
					vam.readContent(md("Library/a.md")),
				),
			),
		).toBeInstanceOf(VamShutdownError);
	});

	it("fails to build with one VamSetupError that keeps the whole cause", async () => {
		const failing = new Proxy({} as App, {
			get: () => {
				throw new Error("no vault here");
			},
		});
		const adapterFailure = await Effect.runPromiseExit(
			Effect.scoped(Layer.build(VaultActionManager.layer(failing))),
		);
		const setup = typedFailure(adapterFailure);
		expect(setup).toBeInstanceOf(VamSetupError);
		expect((setup as VamSetupError).operation).toBe(
			"create VaultIo adapter",
		);

		// A defect while building: the root cannot be protected.
		const defect = await Effect.runPromiseExit(
			Effect.scoped(
				Layer.build(
					VaultActionManager.layer(makeObsidianVault({}).app, {
						protectedPaths: [""],
					}),
				),
			),
		);
		const wrapped = typedFailure(defect);
		expect(wrapped).toBeInstanceOf(VamSetupError);
		const cause = (wrapped as VamSetupError).cause;
		expect(Cause.isCause(cause)).toBe(true);
		expect(Cause.hasDies(cause as Cause.Cause<unknown>)).toBe(true);
		expect((wrapped as VamSetupError).message).toContain(
			"build the Vault Action Manager",
		);
		expect((wrapped as VamSetupError).message).toContain("root");

		expect(() =>
			createVaultActionManager(makeObsidianVault({}).app, {
				protectedPaths: [""],
			}),
		).toThrow(VamSetupError);
	});

	it("reads and writes only inside a hidden folder", async () => {
		const files = new Map<string, string>();
		const folders: string[] = [];
		const vault = makeObsidianVault({});
		(vault.app.vault as unknown as { adapter: unknown }).adapter = {
			exists: async (path: string) =>
				files.has(path) || folders.includes(path),
			mkdir: async (path: string) => {
				folders.push(path);
			},
			read: async (path: string) => {
				const content = files.get(path);
				if (content === undefined) throw new Error(`no ${path}`);
				return content;
			},
			write: async (path: string, data: string) => {
				files.set(path, data);
			},
		};
		(vault.app.vault as unknown as { configDir: string }).configDir =
			".obsidian";
		const { dispose, manager } = createVaultActionManager(vault.app);
		const cache = manager.hiddenFolder(".textfresser");
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				yield* cache.mkdir("segmentation/ab");
				yield* cache.write("segmentation/ab/key.json", "{}");
				return {
					exists: yield* cache.exists("segmentation/ab/key.json"),
					missing: yield* cache.exists("segmentation/cd/key.json"),
					read: yield* cache.read("segmentation/ab/key.json"),
				};
			}),
		);
		expect(result).toEqual({ exists: true, missing: false, read: "{}" });
		expect(folders).toEqual([".textfresser/segmentation/ab"]);
		expect([...files.keys()]).toEqual([
			".textfresser/segmentation/ab/key.json",
		]);

		for (const outside of ["../Library/a.md", "a//b", "./a", ""]) {
			const exit = await Effect.runPromiseExit(cache.write(outside, "x"));
			expect(Exit.isFailure(exit)).toBe(true);
		}
		for (const folder of [
			"Library",
			"../outside",
			"",
			".",
			". .",
			".obsidian",
			".obsidian/plugins/x",
		]) {
			const notHidden = await Effect.runPromiseExit(
				manager.hiddenFolder(folder).write("a.md", "x"),
			);
			expect(Exit.isFailure(notHidden)).toBe(true);
		}
		expect([...files.keys()]).toHaveLength(1);
		await Effect.runPromise(dispose);
	});

	it("disposes once, and every dispose waits for it", async () => {
		const vault = heldVault();
		const { dispose, manager } = createVaultActionManager(vault.app);
		vault.hold();
		const inFlight = Effect.runPromiseExit(
			manager.dispatch([create("Library/b.md", "b")], { caller: "test" }),
		);
		await vault.reachedGate;
		let settled = 0;
		const first = Effect.runPromise(dispose).then(() => settled++);
		const second = Effect.runPromise(dispose).then(() => settled++);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(settled).toBe(0);
		vault.release();
		await Promise.all([first, second]);
		expect(settled).toBe(2);
		expect(Exit.isSuccess(await inFlight)).toBe(true);
	});

	it("resolves a link synchronously, to any kind of file", () => {
		const vault = makeObsidianVault({ "Library/a.md": "a" });
		(
			vault.app.metadataCache as unknown as {
				getFirstLinkpathDest: (link: string) => unknown;
			}
		).getFirstLinkpathDest = (link) =>
			link === "pic" ? { path: "Library/pic.png" } : null;
		const { manager } = createVaultActionManager(vault.app);

		expect(
			Effect.runSync(manager.resolveLinkpath("pic", "Library/a.md")),
		).toBe("Library/pic.png");
		expect(
			Effect.runSync(manager.resolveLinkpath("nothing", "Library/a.md")),
		).toBeNull();
	});
});
