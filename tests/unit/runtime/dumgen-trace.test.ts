import { describe, expect, it } from "bun:test";
import {
	makeRecentTrace,
	type RecordedSpan,
} from "@textfresser/vault-action-manager/diagnostics";
import { Effect, Layer } from "effect";
import {
	ClassifyCommander,
	memorySegmentationCache,
	pendingUnitResolver,
} from "../../../src/commanders/classify";
import { Dumgen } from "../../../src/managers/dumgen";
import { ObservabilityLive } from "../../../src/runtime/observability";
import { makePluginRuntime } from "../../../src/runtime/plugin-runtime";
import { FAENGT_AN_ANSWERS, selectionOf } from "../classify/support";
import { dumgenLayerOver, unreachable } from "../dumgen/dumgen-support";

const STORY = "Der Hund schläft. Er fängt heute an.\n";

/** `span`'s ancestors, nearest first. */
function ancestors(
	spans: readonly RecordedSpan[],
	span: RecordedSpan,
): RecordedSpan[] {
	const byId = new Map(spans.map((each) => [each.spanId, each]));
	const found: RecordedSpan[] = [];
	for (
		let parent = span.parentId && byId.get(span.parentId);
		parent;
		parent = parent.parentId ? byId.get(parent.parentId) : undefined
	)
		found.push(parent);
	return found;
}

describe("dumgen in the plugin runtime", () => {
	it("records a Classify's dumgen.operation and dumgen.call spans under its command span", async () => {
		const trace = makeRecentTrace();
		const runtime = makePluginRuntime(
			Layer.mergeAll(dumgenLayerOver(unreachable)).pipe(
				Layer.provideMerge(ObservabilityLive(trace)),
			),
			{
				onBuildFailed: (cause) => {
					throw new Error(String(cause));
				},
			},
		);
		const dumgen = await runtime.e2e(
			"script-dumgen",
			Effect.gen(function* () {
				const service = yield* Dumgen;
				yield* service.testing.useScripted({ jev: FAENGT_AN_ANSWERS });
				return service;
			}),
		);
		const notices: string[] = [];
		const classify = new ClassifyCommander({
			cache: memorySegmentationCache(),
			dumgen: dumgen.provide,
			missingProviderKeys: dumgen.missingKeys,
			resolver: pendingUnitResolver,
			segmenterVersion: Effect.succeed("test-segmenter"),
		});

		await runtime.command(
			"Classify",
			classify.execute(
				{
					content: STORY,
					scrollPath: "Library/Story.md",
					selection: selectionOf(STORY, "an."),
				},
				(message) => notices.push(message),
			),
		);
		expect(notices).toEqual([
			"Classified 1 unit in 1 Sentence; 1 pending resolution (Resolution is switched off)",
		]);

		const { running, spans } = trace.snapshot();
		expect(running).toEqual([]);
		const command = spans.find(({ name }) => name === "command.Classify");
		const operations = spans.filter(({ name }) => name === "dumgen.operation");
		expect(
			operations.map(({ attributes }) => attributes?.get("dumgen.operation")),
		).toEqual(["language.detect", "segment.inUnits"]);
		const requests = await runtime.e2e(
			"dumgen-requests",
			dumgen.testing.requests,
		);
		const jevRequests = Object.values(requests?.jev ?? {}).reduce(
			(sum, count) => sum + count,
			0,
		);
		for (const operation of operations) {
			expect(
				ancestors(spans, operation).map(({ name }) => name),
			).toContain("command.Classify");
			expect(ancestors(spans, operation).at(-1)).toBe(command);
			const calls = spans.filter(
				({ name, parentId }) =>
					name === "dumgen.call" && parentId === operation.spanId,
			);
			expect(calls.length).toBeGreaterThan(0);
			expect(operation.attributes?.get("dumgen.requests")).toBe(calls.length);
			expect(operation.attributes?.get("dumgen.requests.jev")).toBe(
				calls.length,
			);
		}
		// Every jev request is one dumgen.call under an operation.
		expect(
			spans.filter(({ name }) => name === "dumgen.call").length,
		).toBe(jevRequests);
		expect(requests?.luna).toEqual({});
		await runtime.dispose();
	});
});
