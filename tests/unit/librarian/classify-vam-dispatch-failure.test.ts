import { describe, expect, it } from "bun:test";
import {
	VamDispatchOverflowError,
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager";
import { classifyVamDispatchFailure } from "../../../src/commanders/librarian/runtime/library-reconciliation";
import { actionError, failedActions, notRun } from "../../support/vam-dispatch";

const action: VaultAction = {
	kind: VaultActionKind.CreateFolder,
	payload: {
		splitPath: { basename: "Section", kind: "Folder", pathParts: ["Library"] },
	},
};

describe("classifyVamDispatchFailure", () => {
	it("treats a failed action that may have written as uncertain", () => {
		expect(
			classifyVamDispatchFailure(
				failedActions([actionError(action, "failed", "io")], {
					skipped: [action],
				}),
			),
		).toBe("ExecutionUncertain");
	});

	it("treats a batch whose only failure wrote nothing as not executed", () => {
		expect(
			classifyVamDispatchFailure(
				failedActions([actionError(action, "lost a race", "conflict")]),
			),
		).toBe("FailedBeforeExecution");
	});

	it("treats a batch that refused before running as not executed", () => {
		const overflow = new VamDispatchOverflowError({
			action,
			cause: "full",
			limit: 500,
			operation: "dispatch.overflow",
		});
		expect(classifyVamDispatchFailure(notRun(overflow, [action]))).toBe(
			"FailedBeforeExecution",
		);
	});
});
