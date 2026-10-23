import { describe, expect, it } from "bun:test";
import { EditorState } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { UserEventKind } from "@textfresser/obsidian-event-layer";
import { VaultActionManager } from "@textfresser/vault-action-manager";
import {
	makeRecentTrace,
	type RecordedSpan,
} from "@textfresser/vault-action-manager/diagnostics";
import { Context, Deferred, Effect, Exit, Layer, Scope } from "effect";
import type { App } from "obsidian";
import { createClipboardHandler } from "../../../src/managers/obsidian/behavior-manager/clipboard-behavior";
import { createWikilinkCompletionHandler } from "../../../src/managers/obsidian/behavior-manager/wikilink-complition-behavior";
import { makeObsidianVault } from "../../../src/packages/independent/vault-action-manager/tests/unit/helpers/obsidian-vault";
import { UserEvents } from "../../../src/plugin/user-events";
import { ObservabilityLive } from "../../../src/runtime/observability";
import { makePluginRuntime } from "../../../src/runtime/plugin-runtime";
import { IdleTracker, IdleTrackerLive } from "../../../src/utils/idle-tracker";
import {
	FakeElement,
	fakeApp,
	fakeClipboard,
	fakeDocument,
	fakeEditorView,
	fakeEvent,
} from "../../support/event-layer";
import { fakeHost } from "../../support/obsidian-host";

const STORY = "Library/Story.md";

/**
 * The plugin's user events, as the plugin builds them: over the plugin
 * host on a fake plugin, VAM over an in-memory vault and the idle tracker,
 * on a plugin runtime with its own trace.
 */
async function makeUserEvents() {
	const host = fakeHost();
	const vault = makeObsidianVault({ [STORY]: "Der Fahrer fährt." });
	const trace = makeRecentTrace();
	const runtime = makePluginRuntime(
		Layer.mergeAll(
			host.layer,
			VaultActionManager.layer(vault.app, { observability: "host" }),
			IdleTrackerLive,
		).pipe(Layer.provideMerge(ObservabilityLive(trace))),
		{
			onBuildFailed: () => {
				throw new Error("the runtime did not build");
			},
		},
	);
	const dom = fakeDocument();
	const scope = Scope.makeUnsafe();
	const built = await runtime.e2e(
		"build",
		Scope.provide(scope)(
			Layer.build(
				UserEvents.layer({
					app: fakeApp(STORY) as App,
					document: dom.document,
					runtime,
				}),
			),
		),
	);
	const spans = (name: string): RecordedSpan[] =>
		trace.snapshot().spans.filter((span) => span.name === name);
	/** Whether `span` descends from `root`. */
	const under = (span: RecordedSpan, root: RecordedSpan): boolean => {
		const byId = new Map(trace.snapshot().spans.map((s) => [s.spanId, s]));
		for (
			let parent = span.parentId && byId.get(span.parentId);
			parent;
			parent = parent.parentId ? byId.get(parent.parentId) : undefined
		)
			if (parent.spanId === root.spanId) return true;
		return false;
	};
	/** The editor extensions every editor holds now. */
	const editorListeners = () =>
		EditorState.create({
			extensions: host.obsidian.registeredExtensions as never,
		}).facet(EditorView.updateListener);
	return {
		close: () => runtime.e2e("close", Scope.close(scope, Exit.void)),
		dom,
		editorListeners,
		host,
		layer: Context.get(built, UserEvents),
		pending: () =>
			runtime.e2e(
				"pending",
				Effect.flatMap(IdleTracker, (idle) => idle.pending),
			),
		runtime,
		spans,
		under,
		vault,
	};
}

/** Types `]]` at the end of `[[Fahrer`, as the editor reports it. */
function completeLink(listeners: readonly ((update: ViewUpdate) => void)[]) {
	const view = fakeEditorView("Der [[Fahrer]] fährt.", "Der [[Fahrer]]".length);
	const update = {
		docChanged: true,
		state: view.state,
		transactions: [],
		view,
	} as unknown as ViewUpdate;
	for (const listener of listeners) listener(update);
	return view;
}

describe("the plugin's user events", () => {
	it("run a wikilink completion as user-event.wikilinkCompleted, with VAM's resolution under it", async () => {
		const events = await makeUserEvents();
		events.layer.setHandler(
			UserEventKind.WikilinkCompleted,
			createWikilinkCompletionHandler({
				findMatchingLeavesByCoreName: () => [],
				resolveWikilinkAlias: () => null,
			}),
		);

		const view = completeLink(events.editorListeners());

		// It ran at once, inside the editor's update.
		expect(view.state.doc.toString()).toBe(
			"Der [[Worter/f/fah/fahre/fahrer|Fahrer]] fährt.",
		);
		const [root] = events.spans("user-event.wikilinkCompleted");
		expect(root?.parentId).toBeUndefined();
		expect(root?.status).toBe("ok");
		const [resolution] = events.spans("VaultIo.resolveLinkpathDest");
		expect(resolution && root && events.under(resolution, root)).toBe(true);
		await events.close();
		await events.runtime.dispose();
	});

	it("answer a copy inside its event, on the plugin runtime, as the clipboard needs", async () => {
		const events = await makeUserEvents();
		events.layer.setHandler(
			UserEventKind.ClipboardCopy,
			createClipboardHandler(),
		);
		events.dom.state.selection = "[[__-Märchen|← Märchen]]\nEs war einmal.";
		const clipboard = fakeClipboard();

		const copied = events.dom.fire(
			fakeEvent("copy", { clipboardData: clipboard }),
		);

		expect(copied.defaultPrevented).toBe(true);
		expect(clipboard.text).toBe("Es war einmal.");
		expect(events.spans("user-event.clipboardCopy")[0]?.status).toBe("ok");
		await events.close();
		await events.runtime.dispose();
	});

	it("stop as their scope closes: every DOM listener is removed and the editor extension switched off", async () => {
		const events = await makeUserEvents();
		let completions = 0;
		events.layer.setHandler(UserEventKind.WikilinkCompleted, {
			doesApply: () => true,
			handle: () =>
				Effect.sync(() => {
					completions++;
					return { outcome: "passthrough" } as const;
				}),
		});
		expect(events.dom.listeners()).toEqual([
			{ capture: true, type: "mousedown" },
			{ capture: true, type: "mouseup" },
			{ capture: true, type: "click" },
			{ capture: false, type: "copy" },
			{ capture: false, type: "cut" },
			{ capture: true, type: "keydown" },
			{ capture: false, type: "mouseup" },
			{ capture: false, type: "keyup" },
			{ capture: false, type: "dragend" },
		]);
		expect(events.editorListeners()).toHaveLength(1);
		completeLink(events.editorListeners());
		expect(completions).toBe(1);
		const updates = events.host.obsidian.optionUpdates();

		await events.close();

		expect(events.dom.listeners()).toEqual([]);
		expect(events.editorListeners()).toHaveLength(0);
		// Every open editor was told to drop it.
		expect(events.host.obsidian.optionUpdates()).toBe(updates + 1);
		await events.runtime.dispose();
	});

	it("count a click's handling as pending work until it ends, and trace no selection change", async () => {
		const events = await makeUserEvents();
		const reopened = Deferred.makeUnsafe<void>();
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			afterwards: () => Deferred.await(reopened),
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "passthrough" } as const),
		});
		events.layer.setHandler(UserEventKind.SelectionChanged, {
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "passthrough" } as const),
		});
		const link = new FakeElement("A", ["internal-link"]).setAttribute(
			"data-href",
			"Fahrer",
		);
		link.textContent = "Fahrer";
		new FakeElement("P").append(link);

		events.dom.fire(fakeEvent("mousedown", { target: link }));
		events.dom.fire(fakeEvent("dragend"));

		expect(await events.pending()).toBe(1);
		expect(events.host.opened).toEqual([
			{ newLeaf: false, sourcePath: STORY, target: "Fahrer" },
		]);
		Deferred.doneUnsafe(reopened, Exit.void);
		for (let round = 0; round < 50 && (await events.pending()) > 0; round++)
			await new Promise((resolve) => setTimeout(resolve, 2));
		expect(await events.pending()).toBe(0);
		const [click] = events.spans("user-event.wikilinkClicked");
		expect(click?.status).toBe("ok");
		expect(events.spans("Workspace.openLink")[0]?.parentId).toBe(
			click?.spanId,
		);
		expect(events.spans("user-event.selectionChanged")).toEqual([]);
		await events.close();
		await events.runtime.dispose();
	});
});
