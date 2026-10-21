import { describe, expect, it } from "bun:test";
import { isCompleteJson } from "./cli";
import { HarnessError } from "./errors";
import { runProcess } from "./process";

/** A process that prints its answer and then does not exit for a minute. */
const ANSWER_THEN_HANG = ["-c", 'printf \'{"ok":true}\\n\'; exec sleep 60'];

describe("process runner", () => {
	it("finishes a run once its output is the whole answer, though the process lingers", async () => {
		const startedAt = Date.now();
		const result = await runProcess("/bin/sh", ANSWER_THEN_HANG, {
			completeWhen: isCompleteJson,
			timeoutMs: 5_000,
		});
		expect(result).toEqual({ exitCode: 0, stderr: "", stdout: '{"ok":true}' });
		expect(Date.now() - startedAt).toBeLessThan(5_000);
	});

	it("still times out a lingering process without a completion rule", async () => {
		await expect(
			runProcess("/bin/sh", ANSWER_THEN_HANG, { timeoutMs: 300 }),
		).rejects.toBeInstanceOf(HarnessError);
	});

	it("takes only a whole JSON value as a complete CLI answer", () => {
		expect(isCompleteJson('=> {"ok":true}')).toBe(true);
		expect(isCompleteJson('{"ok":tr')).toBe(false);
		expect(isCompleteJson("Error: renderer exploded")).toBe(false);
		expect(isCompleteJson("")).toBe(false);
	});
});
