import { describe, expect, it, spyOn } from "bun:test";
import {
	extractScrollStatusActions,
	type LibraryIssue,
	makeCodecRulesFromSettings,
	makeCodecs,
	type TreeAction,
	TreeActionType,
	TreeNodeKind,
	TreeNodeStatus,
} from "@textfresser/library-core";
import { makeRecentTrace } from "@textfresser/vault-action-manager/diagnostics";
import { Effect } from "effect";
import { logLibraryIssues } from "../../../src/commanders/librarian/runtime/log-library-issues";
import { ObservabilityLive } from "../../../src/runtime/observability";
import { makePluginRuntime } from "../../../src/runtime/plugin-runtime";
import { defaultSettingsForUnitTests } from "../common-utils/consts";

const codecs = makeCodecs(
	makeCodecRulesFromSettings(defaultSettingsForUnitTests),
);

const changeStatus = (segmentId: string): TreeAction =>
	({
		actionType: TreeActionType.ChangeStatus,
		newStatus: TreeNodeStatus.Done,
		targetLocator: {
			segmentId,
			segmentIdChainToParent: ["Library﹘Section﹘"],
			targetKind: TreeNodeKind.Scroll,
		},
	}) as TreeAction;

describe("Library issues", () => {
	it("are returned by pure library-core, which logs nothing", () => {
		const { actions, issues } = extractScrollStatusActions(
			[changeStatus("Note﹘Scroll﹘md"), changeStatus("not a segment id")],
			codecs,
		);

		expect(actions).toHaveLength(1);
		expect(issues).toHaveLength(1);
		expect(issues[0]?.severity).toBe("Error");
		expect(issues[0]?.message).toContain("scroll segment ID");
	});

	it("are logged by the Librarian at their level, with their error, under its span", async () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		const error = spyOn(console, "error").mockImplementation(() => {});
		const trace = makeRecentTrace();
		const runtime = makePluginRuntime(ObservabilityLive(trace), {
			onBuildFailed: () => {},
		});
		const issues: LibraryIssue[] = [
			{
				error: { kind: "SuffixError", reason: "empty part" },
				message: "[Codex] Failed to compute scroll split path:",
				severity: "Warning",
			},
			{
				error: "bad id",
				message: "[Librarian] Failed to parse scroll segment ID:",
				severity: "Error",
			},
		];
		await runtime.command(
			"heal",
			logLibraryIssues(issues).pipe(Effect.withSpan("Heal")),
		);
		await runtime.dispose();
		warn.mockRestore();
		error.mockRestore();

		const { logs, spans } = trace.snapshot();
		const heal = spans.find((span) => span.name === "Heal");
		expect(
			logs.map(({ cause, level, spanId, text }) => ({
				cause: cause?.split("\n")[0],
				level,
				text,
				underHeal: spanId === heal?.spanId,
			})),
		).toEqual([
			{
				cause: 'Error: {"kind":"SuffixError","reason":"empty part"}',
				level: "WARN",
				text: "[Codex] Failed to compute scroll split path:",
				underHeal: true,
			},
			{
				cause: "Error: bad id",
				level: "ERROR",
				text: "[Librarian] Failed to parse scroll segment ID:",
				underHeal: true,
			},
		]);
	});
});
