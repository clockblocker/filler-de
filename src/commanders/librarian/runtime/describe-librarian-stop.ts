import {
	type AnySplitPath,
	splitPathCodec,
	VamDispatchError,
	VamDispatchStoppedError,
} from "@textfresser/vault-action-manager";
import { Predicate } from "effect";
import { getErrorMessage } from "../../../utils/get-error-message";

export const RESTART_LIBRARIAN_COMMAND_NAME = "Restart Librarian";

/** Whether the Librarian stopped while starting, or later on a vault change. */
export type LibrarianStopPhase = "Startup" | "Runtime";

type FailedItem = { readonly path: string | null; readonly reason: string };

const MAX_LISTED_ITEMS = 3;

/**
 * The notice for a Librarian that stopped: that it stopped, why, with the
 * files whose healing failed, and what to do about it.
 *
 * `failure` is what stopped it: a reconciliation outcome, or the error that
 * failed startup before reconciling.
 */
export function describeLibrarianStop(
	phase: LibrarianStopPhase,
	failure: unknown,
): string {
	const items = dedupe(collectFailedItems(failure));
	const files = items.filter((item) => item.path !== null);
	const lines = [
		phase === "Startup"
			? "The Librarian stopped: it could not heal the library at startup."
			: "The Librarian stopped: it could not heal the library after a change.",
	];
	if (wasRescanned(failure))
		lines.push("A rescan of the library did not fix it.");

	if (files.length > 0) {
		lines.push(`Failed: ${listItems(files)}.`);
		lines.push(
			`Fix or move these files, then run "${RESTART_LIBRARIAN_COMMAND_NAME}" from the command palette.`,
		);
	} else {
		if (items.length > 0) lines.push(`Reason: ${listItems(items)}.`);
		lines.push(
			`Run "${RESTART_LIBRARIAN_COMMAND_NAME}" from the command palette to try again.`,
		);
	}
	lines.push("Details are in the developer console.");
	return lines.join(" ");
}

function listItems(items: readonly FailedItem[]): string {
	const listed = items
		.slice(0, MAX_LISTED_ITEMS)
		.map((item) =>
			item.path === null ? item.reason : `${item.path} (${item.reason})`,
		);
	const rest = items.length - listed.length;
	return rest > 0
		? `${listed.join("; ")}; and ${rest} more`
		: listed.join("; ");
}

function dedupe(items: readonly FailedItem[]): FailedItem[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		const key = `${item.path}\u0000${item.reason}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function isReconciliationOutcome(value: unknown): value is {
	readonly failure?: unknown;
	readonly recovery: { readonly cause?: unknown; readonly kind: string };
} {
	return (
		Predicate.hasProperty(value, "recovery") &&
		Predicate.hasProperty(value, "dispatch") &&
		Predicate.hasProperty(value, "treeActions") &&
		Predicate.hasProperty(value.recovery, "kind")
	);
}

/** A failed recovery whose cause is not the original failure ran a rescan. */
function wasRescanned(failure: unknown): boolean {
	return (
		isReconciliationOutcome(failure) &&
		failure.recovery.kind === "Failed" &&
		failure.recovery.cause !== failure.failure
	);
}

function collectFailedItems(failure: unknown): FailedItem[] {
	if (failure === undefined || failure === null) return [];
	if (Array.isArray(failure)) return failure.flatMap(collectFailedItems);

	if (isReconciliationOutcome(failure)) {
		// The last failure is the one that left the Librarian stopped: the
		// rescan's, when there was one.
		return collectFailedItems(
			failure.recovery.kind === "Failed"
				? failure.recovery.cause
				: failure.failure,
		);
	}
	if (failure instanceof VamDispatchStoppedError) {
		return collectFailedItems(failure.failure);
	}
	if (failure instanceof VamDispatchError) {
		return [
			{
				path: actionPath(failure.action),
				reason: getErrorMessage(failure.cause),
			},
		];
	}

	if (Predicate.hasProperty(failure, "kind")) {
		switch (failure.kind) {
			case "DispatchFailed":
				return Predicate.hasProperty(failure, "dispatch") &&
					Predicate.hasProperty(failure.dispatch, "failure")
					? collectFailedItems(failure.dispatch.failure)
					: [];
			case "ReconciliationUnavailable":
				return Predicate.hasProperty(failure, "cause")
					? collectFailedItems(failure.cause)
					: [];
			case "TreeActionFailed":
			case "DerivationFailed":
				return [
					{
						path: null,
						reason: Predicate.hasProperty(failure, "cause")
							? getErrorMessage(failure.cause)
							: failure.kind,
					},
				];
			case "PartialVaultScan":
				return Predicate.hasProperty(failure, "diagnostics")
					? collectFailedItems(failure.diagnostics)
					: [];
		}
	}

	const cause = Predicate.hasProperty(failure, "cause")
		? failure.cause
		: failure;
	const path =
		Predicate.hasProperty(failure, "path") &&
		Predicate.isString(failure.path)
			? failure.path
			: Predicate.hasProperty(failure, "action")
				? actionPath(failure.action)
				: null;
	return [{ path, reason: getErrorMessage(cause) }];
}

function isSplitPath(value: unknown): value is AnySplitPath {
	return (
		Predicate.hasProperty(value, "basename") &&
		Predicate.hasProperty(value, "pathParts") &&
		Predicate.hasProperty(value, "kind")
	);
}

/** The file an action touched; a rename reads `from → to`. */
function actionPath(action: unknown): string | null {
	if (!Predicate.hasProperty(action, "payload")) return null;
	const { payload } = action;
	if (
		Predicate.hasProperty(payload, "from") &&
		Predicate.hasProperty(payload, "to") &&
		isSplitPath(payload.from) &&
		isSplitPath(payload.to)
	) {
		return `${splitPathCodec.format(payload.from)} → ${splitPathCodec.format(payload.to)}`;
	}
	if (
		Predicate.hasProperty(payload, "splitPath") &&
		isSplitPath(payload.splitPath)
	) {
		return splitPathCodec.format(payload.splitPath);
	}
	return null;
}
