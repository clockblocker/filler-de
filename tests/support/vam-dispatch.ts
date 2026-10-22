/**
 * Dispatch failures for fake VAMs, shaped as the real VAM reports them.
 */
import {
	type VamActionFailureKind,
	VamDispatchError,
	VamDispatchFailure,
	VamDispatchReport,
	type VaultAction,
	VaultActionKind,
} from "@textfresser/vault-action-manager";

/** Stands in for the failed action when a test does not care which it is. */
const SOME_ACTION: VaultAction = {
	kind: VaultActionKind.UpsertMdFile,
	payload: {
		splitPath: {
			basename: "failed",
			extension: "md",
			kind: "MdFile",
			pathParts: ["Fake"],
		},
	},
};

/** One action's failure, as the executor raises it. */
export function actionError(
	action: VaultAction | undefined,
	cause: unknown,
	kind: VamActionFailureKind = "io",
): VamDispatchError {
	return new VamDispatchError({
		action: action ?? SOME_ACTION,
		cause,
		kind,
		operation: "executeAction",
	});
}

/** A batch that failed before any of it ran, for `reason`. */
export function notRun(
	reason: Parameters<typeof VamDispatchFailure.notRun>[0],
	actions: readonly VaultAction[] = [],
): VamDispatchFailure {
	return VamDispatchFailure.notRun(reason, actions);
}

/**
 * A batch in which `errors` failed, after `executed` completed and before
 * `skipped`, which a stopped batch never ran.
 */
export function failedActions(
	errors: readonly VamDispatchError[],
	options: {
		readonly executed?: readonly VaultAction[];
		readonly skipped?: readonly VaultAction[];
	} = {},
): VamDispatchFailure {
	const report = new VamDispatchReport({
		entries: [
			...(options.executed ?? []).map((action) => ({
				action,
				outcome: { _tag: "NoOp" } as const,
				status: "Done" as const,
			})),
			...errors.map((error) => VamDispatchReport.entryFor(error)),
			...(options.skipped ?? []).map((action) => ({
				action,
				status: "Skipped" as const,
			})),
		],
	});
	const failure = VamDispatchFailure.ofReport(report);
	if (!failure) throw new Error("failedActions needs at least one error");
	return failure;
}
