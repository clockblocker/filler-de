import { describe, expect, it } from "bun:test";
import {
	VamDispatchError,
	VamDispatchOverflowError,
	VamDispatchStoppedError,
	type VaultAction,
} from "@textfresser/vault-action-manager";
import { classifyVamDispatchFailure } from "../../../src/commanders/librarian/runtime/library-reconciliation";

const action = { kind: "CreateFolder" } as unknown as VaultAction;

function stopped(
	operation: string,
	executed: readonly VaultAction[],
): VamDispatchStoppedError {
	const failure = new VamDispatchError({ action, cause: "failed", operation });
	return new VamDispatchStoppedError({
		action,
		cause: "failed",
		executed,
		failure,
		operation: "dispatch.stopOnFirstFailure",
		skipped: [action],
	});
}

describe("classifyVamDispatchFailure", () => {
	it("treats a stopped batch that already executed actions as uncertain", () => {
		expect(classifyVamDispatchFailure(stopped("plan", [action]))).toBe(
			"ExecutionUncertain",
		);
	});

	it("treats a stopped batch whose first action failed during execution as uncertain", () => {
		expect(classifyVamDispatchFailure(stopped("executeAction", []))).toBe(
			"ExecutionUncertain",
		);
	});

	it("treats a stopped batch that failed before executing anything as not executed", () => {
		expect(
			classifyVamDispatchFailure(stopped("registerSelfEvents", [])),
		).toBe("FailedBeforeExecution");
	});

	it("treats an overflowed submission as not executed", () => {
		const overflow = new VamDispatchOverflowError({
			action,
			cause: "full",
			limit: 500,
			operation: "dispatch.overflow",
		});
		expect(classifyVamDispatchFailure(overflow)).toBe(
			"FailedBeforeExecution",
		);
	});
});
