import { describe, expect, it } from "bun:test";
import {
	makeRecentTrace,
	type RecordedSpan,
} from "@textfresser/vault-action-manager/diagnostics";
import { Effect, Exit, Layer, Scope } from "effect";
import { Notices } from "../../../src/managers/obsidian/host";
import {
	type PluginCommandDeps,
	pluginCommands,
	registerCommands,
} from "../../../src/plugin/register-commands";
import { ObservabilityLive } from "../../../src/runtime/observability";
import { makePluginRuntime } from "../../../src/runtime/plugin-runtime";
import { makeIdleTracker } from "../../../src/utils/idle-tracker";
import { fakeHost, recordingNotices } from "../../support/obsidian-host";

const NOTE = {
	content: "Ein Satz.",
	selection: { text: "Satz" },
	selectionRange: { from: 4, to: 8 },
	splitPath: {
		basename: "Note",
		extension: "md",
		kind: "MdFile",
		pathParts: ["Library"],
	},
};

/** The commands' services, each recording what reached it. */
function fakeDeps(notices: Notices["Service"]) {
	const reached: string[] = [];
	const reach = (what: string) =>
		Effect.sync(() => {
			reached.push(what);
		});
	const deps = {
		classify: {
			classify: { execute: () => reach("classify") },
			knowledgeQueue: { cancelAll: Effect.succeed(2) },
		},
		dictionaryReset: {
			cancel: Effect.succeed(false),
			open: reach("reset.open"),
		},
		idle: Effect.runSync(makeIdleTracker),
		lifecycle: {
			librarian: () => ({
				executeCommand: (kind: string) => reach(`librarian ${kind}`),
			}),
			restart: reach("restart"),
			state: () => ({ kind: "Running" }),
			whenLaunched: reach("whenLaunched"),
		},
		notices,
		textfresser: {
			current: Effect.succeed({
				executeCommand: (kind: string) => reach(`textfresser ${kind}`),
			}),
		},
		vam: {
			getActiveEditorContext: () => Effect.succeed(NOTE),
			getSelectionInfo: () => Effect.succeed(NOTE.selection),
		},
	} as unknown as PluginCommandDeps;
	return { deps, reached };
}

/** What each command reaches, by id. */
const REACHES: Record<string, string> = {
	"cancel-dictionary-reset": "notice No dictionary reset is running",
	"cancel-knowledge-generation":
		"notice Cancelled Knowledge generation for 2 Readings",
	"classify-selection": "classify",
	"reset-dictionary-from-old-notes": "reset.open",
	"restart-librarian": "restart",
	"split-selection-in-blocks": "librarian SplitInBlocks",
	"split-to-pages": "librarian SplitToPages",
	"textfresser-testing-expose-opened-service": "whenLaunched",
	"translate-selection": "textfresser TranslateSelection",
};

describe("the palette commands", () => {
	it("are each registered, and each runs its program under command.<id>", async () => {
		const { layer, notices: recorded, obsidian } = fakeHost();
		const trace = makeRecentTrace();
		const runtime = makePluginRuntime(
			layer.pipe(
				Layer.provideMerge(ObservabilityLive(trace)),
			),
			{
				onBuildFailed: () => {
					throw new Error("the host did not build");
				},
			},
		);
		const { deps, reached } = fakeDeps(Notices.over(recorded.sink));
		const scope = Scope.makeUnsafe();
		await runtime.e2e(
			"register-commands",
			Scope.provide(scope)(registerCommands(deps)),
		);

		const ids = pluginCommands(deps).map(({ id }) => id);
		expect([...obsidian.commands.keys()]).toEqual(ids);
		// Every one but "Copy recent trace", which needs the clipboard.
		const runnable = ids.filter((id) => id !== "copy-recent-trace");
		expect(runnable.sort()).toEqual(Object.keys(REACHES).sort());

		for (const id of runnable) {
			reached.length = 0;
			recorded.shown.length = 0;
			const command = obsidian.commands.get(id);
			const invoke = command?.callback ?? command?.editorCallback;
			(invoke as () => void)();
			await runtime.e2e("settled", Effect.sleep("5 millis"));
			const spans = trace
				.snapshot()
				.spans.filter(
					(span: RecordedSpan) => span.name === `command.${id}`,
				);
			expect({ id, spans: spans.length }).toEqual({ id, spans: 1 });
			expect(spans[0]?.parentId).toBeUndefined();
			expect({
				id,
				reached: [
					...reached,
					...recorded.messages().map((message) => `notice ${message}`),
				],
			}).toEqual({ id, reached: [REACHES[id] as string] });
		}

		await runtime.e2e("close", Scope.close(scope, Exit.void));
		expect(obsidian.commands.size).toBe(0);
		await runtime.dispose();
	});

	it("offer the editor's commands only with a Markdown editor", () => {
		const { deps } = fakeDeps(Notices.over(recordingNotices().sink));
		const editor = pluginCommands(deps)
			.filter((command) => command.editor)
			.map(({ id }) => id);
		expect(editor).toEqual([
			"translate-selection",
			"split-selection-in-blocks",
			"classify-selection",
			"split-to-pages",
		]);
	});
});
