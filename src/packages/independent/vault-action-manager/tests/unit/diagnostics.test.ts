import { describe, expect, it, spyOn } from "bun:test";
import {
	createVaultActionManager,
	type SplitPathToMdFile,
	splitPathCodec,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import {
	describeError,
	formatCause,
	formatValue,
	makeRecentTrace,
} from "@textfresser/vault-action-manager/diagnostics";
import { Cause, Data, Effect, Exit, Fiber, Logger, Schema } from "effect";
import { vamConsoleLogger } from "../../src/effect/logger";
import { makeVaultHarness } from "./helpers/vault-harness";

class ReadFailed extends Schema.TaggedError<ReadFailed>()("ReadFailed", {
	path: Schema.String,
}) {}

class WriteFailed extends Schema.TaggedError<WriteFailed>()("WriteFailed", {
	cause: Schema.Defect(),
	operation: Schema.String,
}) {}

class Refused extends Data.TaggedError("Refused")<{
	readonly message: string;
}> {}

const nested = () =>
	new WriteFailed({
		cause: new ReadFailed({ path: "Worter/Hund.md" }),
		operation: "process",
	});

describe("formatCause", () => {
	it("renders a tagged error's fields, its nested cause and its stack", () => {
		const text = formatCause(Cause.fail(nested()));

		expect(text).toStartWith('WriteFailed (operation="process")\n');
		expect(text).toContain('caused by: ReadFailed (path="Worter/Hund.md")');
		expect(text).toMatch(/\n\s+at /);
		expect(text).not.toContain("{}");
	});

	it("is one line without the stack", () => {
		expect(formatCause(Cause.fail(nested()), { stack: false })).toBe(
			'WriteFailed (operation="process"); caused by ReadFailed (path="Worter/Hund.md")',
		);
	});

	it("marks defects, and keeps a message and its _tag", () => {
		const text = formatCause(
			Cause.combine(
				Cause.fail(new Refused({ message: "protected" })),
				Cause.die(new Error("boom", { cause: new Error("root") })),
			),
			{ stack: false },
		);
		expect(text).toBe(
			"Refused: protected; Defect: Error: boom; caused by Error: root",
		);
	});

	it("names who interrupted, alone or beside a failure", () => {
		expect(formatCause(Cause.interrupt(7))).toBe("Interrupted by fiber #7");
		expect(
			formatCause(Cause.combine(Cause.fail("gone"), Cause.interrupt(3)), {
				stack: false,
			}),
		).toBe("Error: gone; Interrupted by fiber #3");
	});

	it("names a real interruption", async () => {
		const fiber = Effect.runFork(Effect.never);
		const exit = await Effect.runPromise(
			Fiber.interrupt(fiber).pipe(Effect.andThen(Fiber.await(fiber))),
		);
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit))
			expect(formatCause(exit.cause)).toMatch(
				/^Interrupted by fiber #\d+$/,
			);
	});

	it("renders a plain object failure as JSON once", () => {
		expect(
			formatCause(Cause.fail({ kind: "PartialVaultScan" }), {
				stack: false,
			}),
		).toBe('Error: {"kind":"PartialVaultScan"}');
	});
});

describe("describeError and formatValue", () => {
	it("describe thrown values and causes alike", () => {
		expect(describeError(nested(), { stack: false })).toBe(
			formatCause(Cause.fail(nested()), { stack: false }),
		);
		expect(describeError(Cause.interrupt(1))).toBe(
			"Interrupted by fiber #1",
		);
		expect(describeError("plain", { stack: false })).toBe("Error: plain");
	});

	it("never print an Error inside an object as {}", () => {
		const cyclic: Record<string, unknown> = { n: 1n };
		cyclic.self = cyclic;
		expect(formatValue({ error: new Error("inside"), ok: 1 })).toBe(
			'{"error":"Error: inside","ok":1}',
		);
		expect(formatValue(cyclic)).toBe('{"n":"1n","self":"[Circular]"}');
		expect(formatValue("x".repeat(2000)).length).toBeLessThan(600);
	});
});

const inner = Effect.fn("inner")(function* (n: number) {
	yield* Effect.annotateCurrentSpan("n", n);
	yield* Effect.logWarning("checked", n);
	if (n === 2) return yield* new ReadFailed({ path: "b.md" });
	return n;
});

describe("makeRecentTrace", () => {
	it("keeps only the newest spans and log entries", async () => {
		const trace = makeRecentTrace({ logCapacity: 2, spanCapacity: 3 });
		await Effect.runPromise(
			Effect.forEach([1, 3, 4, 5], (n) => inner(n)).pipe(
				Effect.withTracer(trace.tracer),
				Effect.provide(Logger.layer([trace.logger])),
			),
		);

		const { logs, running, spans } = trace.snapshot();
		expect(spans.map(({ attributes }) => attributes?.get("n"))).toEqual([
			3, 4, 5,
		]);
		expect(logs.map(({ text }) => text)).toEqual([
			"checked 4",
			"checked 5",
		]);
		expect(running).toEqual([]);
	});

	it("records status, parent, duration, the cause and the log's span", async () => {
		const trace = makeRecentTrace();
		const exit = await Effect.runPromiseExit(
			Effect.forEach([1, 2], (n) => inner(n)).pipe(
				Effect.withSpan("outer"),
				Effect.withTracer(trace.tracer),
				Effect.provide(Logger.layer([trace.logger])),
			),
		);
		expect(Exit.isFailure(exit)).toBe(true);

		const { logs, spans } = trace.snapshot();
		const [first, second, outer] = spans;
		expect(spans.map(({ name, status }) => `${name} ${status}`)).toEqual([
			"inner ok",
			"inner failed",
			"outer failed",
		]);
		expect(first?.parentId).toBe(outer?.spanId);
		expect(second?.parentId).toBe(outer?.spanId);
		expect(outer?.parentId).toBeUndefined();
		expect((outer?.end ?? 0) - (outer?.start ?? 0)).toBeGreaterThanOrEqual(
			0,
		);
		expect(second?.cause && formatCause(second.cause)).toStartWith(
			'ReadFailed (path="b.md")',
		);
		expect(logs.map(({ spanId }) => spanId)).toEqual([
			first?.spanId,
			second?.spanId,
		]);

		const rendered = trace.render();
		expect(rendered).toMatch(
			/\d\d:\d\d:\d\d\.\d{3} outer [\d.]+ms FAILED\n/,
		);
		expect(rendered).toMatch(/\n {2}\S+ inner [\d.]+ms OK n=1\n/);
		expect(rendered).toMatch(/\n {4}\S+ \[WARN\] checked 1\n/);
		expect(rendered).toContain("inner");
		expect(rendered).toContain("(cause shown above)");
		expect(rendered.match(/ReadFailed/g)).toHaveLength(1);
	});

	it("shows spans still running, and logs made outside Effect", async () => {
		const trace = makeRecentTrace();
		const fiber = Effect.runFork(
			Effect.never.pipe(
				Effect.withSpan("waiting"),
				Effect.withTracer(trace.tracer),
			),
		);
		await Effect.runPromise(Effect.yieldNow);
		trace.recordLog("warn", ["[Plain]", { error: new Error("lost") }]);

		expect(trace.snapshot().running.map(({ name }) => name)).toEqual([
			"waiting",
		]);
		const rendered = trace.render();
		expect(rendered).toMatch(/waiting [\d.]+ms so far RUNNING/);
		expect(rendered).toContain('[WARN] [Plain] {"error":"Error: lost"}');

		await Effect.runPromise(Fiber.interrupt(fiber));
		expect(trace.snapshot().spans.map(({ status }) => status)).toEqual([
			"interrupted",
		]);
	});

	it("forgets the oldest running span past its capacity", async () => {
		const trace = makeRecentTrace({ spanCapacity: 2 });
		const fibers = ["a", "b", "c"].map((name) =>
			Effect.runFork(
				Effect.never.pipe(
					Effect.withSpan(name),
					Effect.withTracer(trace.tracer),
				),
			),
		);
		await Effect.runPromise(Effect.yieldNow);

		expect(trace.snapshot().running.map(({ name }) => name)).toEqual([
			"b",
			"c",
		]);
		await Effect.runPromise(Fiber.interruptAll(fibers));
	});
});

describe("VAM's loggers", () => {
	it("hand the values, the formatted cause, annotations and span to console", () => {
		const error = spyOn(console, "error").mockImplementation(() => {});
		const detail = { path: "a.md" };
		try {
			Effect.runSync(
				Effect.logError(
					"[Test] failed",
					detail,
					Cause.fail(nested()),
				).pipe(
					Effect.annotateLogs("batch", 4),
					Effect.withSpan("Test.span"),
					Effect.provide(Logger.layer([vamConsoleLogger])),
				),
			);
			const args = error.mock.calls[0] ?? [];
			expect(args[0]).toBe("[Test] failed");
			expect(args[1]).toBe(detail);
			expect(String(args[2])).toContain(
				'caused by: ReadFailed (path="Worter/Hund.md")',
			);
			expect(args[3]).toEqual({ batch: 4, span: "Test.span" });
		} finally {
			error.mockRestore();
		}
	});

	it("record VAM's spans and logs when the plugin keeps a trace", async () => {
		const error = spyOn(console, "error").mockImplementation(() => {});
		const trace = makeRecentTrace();
		const harness = makeVaultHarness();
		harness.addFile("Exemplar/Note.md", "# Note");
		const { dispose, manager, testing } = createVaultActionManager(
			harness.app,
			{ protectedPaths: ["Exemplar"], recentTrace: trace },
		);
		try {
			await Effect.runPromiseExit(
				manager.dispatch([
					{
						kind: VaultActionKind.UpsertMdFile,
						payload: {
							content: "changed",
							splitPath: splitPathCodec.parse(
								"Exemplar/Note.md",
							) as SplitPathToMdFile,
						},
					},
				]),
			);
			await Effect.runPromise(testing.whenSettled());

			const { logs, spans } = trace.snapshot();
			expect(spans.length).toBeGreaterThan(0);
			expect(spans.some(({ status }) => status === "failed")).toBe(true);
			const refused = logs.find(({ text }) =>
				text.startsWith("[DispatchBatch] Refused a protected path"),
			);
			expect(refused?.level).toBe("ERROR");
			expect(error).toHaveBeenCalled();
		} finally {
			await Effect.runPromise(dispose);
			error.mockRestore();
		}
	});
});
