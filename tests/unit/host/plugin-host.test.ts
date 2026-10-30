import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	makeRecentTrace,
	type RecordedSpan,
} from "@textfresser/vault-action-manager/diagnostics";
import { Context, Effect, Exit, Layer, Scope } from "effect";
import { PluginHost } from "../../../src/managers/obsidian/host";
import { ObservabilityLive } from "../../../src/runtime/observability";
import { makePluginRuntime } from "../../../src/runtime/plugin-runtime";
import { fakeHost } from "../../support/obsidian-host";

class Greeting extends Context.Service<Greeting, { readonly text: string }>()(
	"test/Greeting",
) {}

/** The host over a fake plugin, on a plugin runtime with its own trace. */
function makeHost() {
	const { layer, obsidian } = fakeHost();
	const trace = makeRecentTrace();
	const runtime = makePluginRuntime(
		Layer.mergeAll(
			layer,
			Layer.succeed(Greeting, { text: "hello" }),
		).pipe(Layer.provideMerge(ObservabilityLive(trace))),
		{
			onBuildFailed: () => {
				throw new Error("the host did not build");
			},
		},
	);
	const scope = Scope.makeUnsafe();
	/** Runs `effect` in `scope`, as a Layer registering in its scope would. */
	const inScope = <A, E>(
		effect: Effect.Effect<A, E, PluginHost | Greeting | Scope.Scope>,
	) => runtime.e2e("register", Scope.provide(scope)(effect));
	const close = () =>
		runtime.e2e("close", Scope.close(scope, Exit.void));
	const spans = (name: string): RecordedSpan[] =>
		trace.snapshot().spans.filter((span) => span.name === name);
	return { close, inScope, obsidian, runtime, spans, trace };
}

/** Lets every fiber and promise that can move, move. */
async function until(done: () => boolean): Promise<void> {
	for (let round = 0; round < 200 && !done(); round++)
		await new Promise((resolve) => setTimeout(resolve, 5));
	if (!done()) throw new Error("timed out");
}

describe("PluginHost.command", () => {
	it("runs each invocation under its own root span, with the services of the fiber that registered it", async () => {
		const host = makeHost();
		const greetings: string[] = [];
		await host.inScope(
			Effect.flatMap(PluginHost, (plugin) =>
				plugin.command({
					id: "greet",
					name: "Greet",
					run: Effect.flatMap(Greeting, ({ text }) =>
						Effect.sync(() => {
							greetings.push(text);
						}).pipe(Effect.withSpan("Greet.step")),
					),
				}),
			),
		);

		const command = host.obsidian.commands.get("greet");
		expect(command?.name).toBe("Greet");
		expect(command?.editorCallback).toBeUndefined();
		command?.callback?.();
		command?.callback?.();
		await until(() => host.spans("Greet.step").length === 2);

		expect(greetings).toEqual(["hello", "hello"]);
		const roots = host.spans("command.greet");
		expect(roots).toHaveLength(2);
		for (const root of roots) expect(root.parentId).toBeUndefined();
		expect(host.spans("Greet.step").map((step) => step.parentId)).toEqual(
			roots.map((root) => root.spanId),
		);
		await host.runtime.dispose();
	});

	it("offers an editor command only through Obsidian's editor callback", async () => {
		const host = makeHost();
		let ran = 0;
		await host.inScope(
			Effect.flatMap(PluginHost, (plugin) =>
				plugin.command({
					editor: true,
					id: "edit",
					name: "Edit",
					run: Effect.sync(() => {
						ran++;
					}),
				}),
			),
		);
		const command = host.obsidian.commands.get("edit");
		expect(command?.callback).toBeUndefined();
		(command?.editorCallback as (() => void) | undefined)?.();
		await until(() => ran === 1);
		await host.runtime.dispose();
	});

	it("is removed when its scope closes, and not again once the plugin unloaded", async () => {
		const host = makeHost();
		const register = (id: string) =>
			host.inScope(
				Effect.flatMap(PluginHost, (plugin) =>
					plugin.command({ id, name: id, run: Effect.void }),
				),
			);
		await register("first");
		await host.close();
		expect(host.obsidian.commands.has("first")).toBe(false);
		expect(host.obsidian.removedCommands).toEqual(["first"]);

		// Obsidian removes it as the plugin unloads; a reloaded plugin may
		// already hold a command of that id, so the scope leaves it be.
		const later = makeHost();
		await later.inScope(
			Effect.flatMap(PluginHost, (plugin) =>
				plugin.command({ id: "second", name: "second", run: Effect.void }),
			),
		);
		later.obsidian.unload();
		expect(later.obsidian.commands.has("second")).toBe(false);
		await later.close();
		expect(later.obsidian.removedCommands).toEqual([]);

		// Nor is anything added after the unload.
		await later.inScope(
			Effect.flatMap(PluginHost, (plugin) =>
				plugin.command({ id: "third", name: "third", run: Effect.void }),
			),
		);
		expect(later.obsidian.commands.has("third")).toBe(false);
		await host.runtime.dispose();
		await later.runtime.dispose();
	});

	it("runs nothing once the runtime is disposed", async () => {
		const host = makeHost();
		let ran = false;
		await host.inScope(
			Effect.flatMap(PluginHost, (plugin) =>
				plugin.command({
					id: "late",
					name: "Late",
					run: Effect.sync(() => {
						ran = true;
					}),
				}),
			),
		);
		const command = host.obsidian.commands.get("late");
		await host.runtime.dispose();
		command?.callback?.();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(ran).toBe(false);
	});
});

describe("PluginHost listeners", () => {
	let error: ReturnType<typeof spyOn>;
	beforeEach(() => {
		error = spyOn(console, "error").mockImplementation(() => {});
	});
	afterEach(() => {
		error.mockRestore();
	});

	it("hears workspace and DOM events only while the scope is open", async () => {
		const host = makeHost();
		const target = new EventTarget();
		const heard: string[] = [];
		await host.inScope(
			Effect.gen(function* () {
				const plugin = yield* PluginHost;
				yield* plugin.onWorkspace("file-open", (file) => {
					heard.push(`file-open ${file?.path ?? "none"}`);
				});
				yield* plugin.onWorkspace("layout-change", () => {
					heard.push("layout-change");
				});
				yield* plugin.onDom(
					target as unknown as Window,
					"scroll",
					() => {
						heard.push("scroll");
					},
					true,
				);
			}),
		);
		host.obsidian.trigger("file-open", { path: "Note.md" });
		host.obsidian.trigger("layout-change");
		target.dispatchEvent(new Event("scroll"));
		expect(heard).toEqual(["file-open Note.md", "layout-change", "scroll"]);

		await host.close();
		expect(host.obsidian.listening("file-open")).toEqual([]);
		expect(host.obsidian.listening("layout-change")).toEqual([]);
		host.obsidian.trigger("layout-change");
		target.dispatchEvent(new Event("scroll"));
		expect(heard).toHaveLength(3);
		await host.runtime.dispose();
	});

	it("releases each listener once: by the scope, or by Obsidian as the plugin unloads", async () => {
		const host = makeHost();
		const register = Effect.flatMap(PluginHost, (plugin) =>
			plugin.onWorkspace("resize", () => {}),
		);
		await host.inScope(register);
		await host.close();
		host.obsidian.unload();
		expect(host.obsidian.offrefs).toEqual(["resize"]);

		const unloadedFirst = makeHost();
		await unloadedFirst.inScope(register);
		// Obsidian's unload releases it at once, before the runtime's
		// disposal reaches the scope.
		unloadedFirst.obsidian.unload();
		expect(unloadedFirst.obsidian.listening("resize")).toEqual([]);
		await unloadedFirst.close();
		expect(unloadedFirst.obsidian.offrefs).toEqual(["resize"]);
		await host.runtime.dispose();
		await unloadedFirst.runtime.dispose();
	});

	it("logs what a handler throws instead of throwing it into Obsidian", async () => {
		const host = makeHost();
		await host.inScope(
			Effect.flatMap(PluginHost, (plugin) =>
				plugin.onWorkspace("layout-change", () => {
					throw new Error("broken toolbar");
				}),
			),
		);
		expect(() => host.obsidian.trigger("layout-change")).not.toThrow();
		expect(error).toHaveBeenCalled();
		await host.runtime.dispose();
	});
});

describe("PluginHost.editorExtension", () => {
	it("registers one list with Obsidian, and takes an extension out of it when its scope closes", async () => {
		const host = makeHost();
		const first = { extension: "first" };
		const second = { extension: "second" };
		await host.inScope(
			Effect.gen(function* () {
				const plugin = yield* PluginHost;
				yield* plugin.editorExtension(first as never);
				yield* plugin.editorExtension(second as never);
			}),
		);
		expect(host.obsidian.registeredExtensions).toHaveLength(1);
		const [registered] = host.obsidian.registeredExtensions;
		expect(registered).toEqual([first, second]);
		expect(host.obsidian.optionUpdates()).toBe(2);

		await host.close();
		expect(registered).toEqual([]);
		expect(host.obsidian.optionUpdates()).toBe(4);
		await host.runtime.dispose();
	});

	it("leaves the list to Obsidian as the plugin unloads, without updating the editors", async () => {
		const host = makeHost();
		await host.inScope(
			Effect.flatMap(PluginHost, (plugin) =>
				plugin.editorExtension({ extension: "only" } as never),
			),
		);
		expect(host.obsidian.optionUpdates()).toBe(1);
		host.obsidian.unload();
		await host.close();
		expect(host.obsidian.optionUpdates()).toBe(1);
		await host.runtime.dispose();
	});
});

describe("PluginHost.markdownPostProcessor", () => {
	it("registers one post-processor with Obsidian, which runs those whose scope is open", async () => {
		const host = makeHost();
		const preview = host.obsidian.openPreview();
		const ran: string[] = [];
		await host.inScope(
			Effect.gen(function* () {
				const plugin = yield* PluginHost;
				yield* plugin.markdownPostProcessor(() => {
					ran.push("first");
				});
				yield* plugin.markdownPostProcessor(() => {
					throw new Error("a broken post-processor");
				});
				yield* plugin.markdownPostProcessor(() => {
					ran.push("third");
				});
			}),
		);
		expect(host.obsidian.postProcessors).toHaveLength(1);
		// Open Reading views render again, once, with the first.
		expect(preview.rerendered).toBe(1);
		const error = spyOn(console, "error").mockImplementation(() => {});
		host.obsidian.postProcess({});
		error.mockRestore();
		// One that throws is logged, and stops none of the others.
		expect(ran).toEqual(["first", "third"]);

		await host.close();
		host.obsidian.postProcess({});
		expect(ran).toEqual(["first", "third"]);
		await host.runtime.dispose();
	});
});
