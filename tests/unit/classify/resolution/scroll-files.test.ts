import { describe, expect, it } from "bun:test";
import type { VaultAction } from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { vamScrollFiles } from "../../../../src/commanders/classify/resolution/scroll-files";
import { actionError, failedActions } from "../../../support/vam-dispatch";

function failingWith(kind: "conflict" | "io") {
	return vamScrollFiles({
		dispatchStopOnFirstFailure: (actions: readonly VaultAction[]) =>
			Effect.fail(
				failedActions([
					actionError(actions[0], new Error("write failed"), kind),
				]),
			),
	});
}

describe("vamScrollFiles", () => {
	it("flags a write whose Scroll changed under it as a conflict", async () => {
		const failure = await Effect.runPromise(
			failingWith("conflict")
				.process("Library/Scroll.md", (current) => current)
				.pipe(Effect.flip),
		);

		expect(failure.conflict).toBe(true);
	});

	it("does not flag other write failures", async () => {
		const failure = await Effect.runPromise(
			failingWith("io")
				.process("Library/Scroll.md", (current) => current)
				.pipe(Effect.flip),
		);

		expect(failure.conflict).toBe(false);
	});
});
