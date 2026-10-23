import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { makeRecentTrace } from "@textfresser/vault-action-manager/diagnostics";
import { Exit, Layer, Scope } from "effect";
import { listenForOverlay } from "../../../src/managers/overlay-manager/overlay-listeners";
import { ObservabilityLive } from "../../../src/runtime/observability";
import { makePluginRuntime } from "../../../src/runtime/plugin-runtime";
import { fakeHost } from "../../support/obsidian-host";

/** A window that only dispatches events, and counts its listeners. */
function scrollWindow() {
	const target = new EventTarget();
	let listeners = 0;
	const add = target.addEventListener.bind(target);
	const remove = target.removeEventListener.bind(target);
	target.addEventListener = (...args) => {
		listeners++;
		add(...args);
	};
	target.removeEventListener = (...args) => {
		listeners--;
		remove(...args);
	};
	return { listeners: () => listeners, target };
}

describe("the overlay's workspace listeners", () => {
	const global = globalThis as { window?: unknown };
	let previous: unknown;
	let window: ReturnType<typeof scrollWindow>;
	beforeEach(() => {
		previous = global.window;
		window = scrollWindow();
		global.window = window.target;
	});
	afterEach(() => {
		global.window = previous;
	});

	it("reach the overlay while their scope is open, and are all gone once it closes", async () => {
		const { layer, obsidian } = fakeHost();
		const runtime = makePluginRuntime(
			layer.pipe(
				Layer.provideMerge(ObservabilityLive(makeRecentTrace())),
			),
			{
				onBuildFailed: () => {
					throw new Error("the host did not build");
				},
			},
		);
		const told: string[] = [];
		const overlay = {
			hideSelectionToolbar: () => told.push("hide"),
			onEditorMenu: () => told.push("menu"),
			refreshToolbars: () => told.push("refresh"),
		};
		const scope = Scope.makeUnsafe();
		await runtime.e2e(
			"listen",
			Scope.provide(scope)(listenForOverlay(overlay)),
		);
		obsidian.trigger("file-open", null);
		obsidian.trigger("layout-change");
		obsidian.trigger("editor-menu", {});
		window.target.dispatchEvent(new Event("scroll"));
		expect(told).toEqual(["refresh", "refresh", "menu", "hide"]);

		await runtime.e2e("close", Scope.close(scope, Exit.void));
		for (const event of ["file-open", "layout-change", "editor-menu"])
			expect({ event, listening: obsidian.listening(event).length }).toEqual(
				{ event, listening: 0 },
			);
		expect(window.listeners()).toBe(0);
		obsidian.trigger("layout-change");
		window.target.dispatchEvent(new Event("scroll"));
		expect(told).toHaveLength(4);
		await runtime.dispose();
	});
});
