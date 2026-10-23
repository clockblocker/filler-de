import { Result } from "effect";
import type { Codecs } from "../../../../../../codecs";
import {
	type CreateObservationDiagnostic,
	translateCreateObservation,
} from "../../../../../../tree/create-observation";
import { PREFIX_OF_CODEX } from "../../../../codex/literals";
import type { LibraryIssue } from "../../../../types/library-issue";
import type { TreeAction } from "../../../types/tree-action";
import {
	MaterializedEventKind as MaterializedEventType,
	type MaterializedNodeEvent,
} from "../materialized-node-events/types";
import { traslateDeleteMaterializedEvent } from "./translators/translate-delete-material-event";
import { traslateRenameMaterializedEvent } from "./translators/traslate-rename-materila-event";

export type MaterializedEventTranslation = {
	readonly createDiagnostics: readonly CreateObservationDiagnostic[];
	/** Why some renames were not translated. */
	readonly issues: readonly LibraryIssue[];
	readonly treeActions: readonly TreeAction[];
};

/**
 * Converts `MaterializedNodeEvent[]` into semantic `TreeAction[]`.
 *
 * What this does:
 * - Translates each **materialized, single-node event** into one or more
 *   high-level Tree actions (`Create`, `Delete`, `Rename`, `Move`).
 * - Performs **canonicalization, policy inference, and intent inference**
 *   (NameKing / PathKing, Rename vs Move) as required.
 * - Produces actions expressed **purely in Tree terms** using canonical
 *   node locators.
 *
 * Mapping:
 * - `Create` → `CreateTreeLeafAction`
 * - `Delete` → `DeleteNodeAction`
 * - `Rename` → `RenameNodeAction` **or** `MoveNodeAction`
 *
 * Guarantees:
 * - All returned actions target **canonical tree locators**.
 * - All filesystem references (`observedVaultSplitPath`) reflect the
 *   *actual* observed vault state and are suitable for healing.
 * - No outside-Library events are present at this stage.
 *
 */
export const translateMaterializedEvents = (
	events: MaterializedNodeEvent[],
	codecs: Codecs,
): MaterializedEventTranslation => {
	const createDiagnostics: CreateObservationDiagnostic[] = [];
	const issues: LibraryIssue[] = [];
	const out: TreeAction[] = [];

	for (const ev of events) {
		switch (ev.kind) {
			case MaterializedEventType.Create: {
				const translation = translateCreateObservation(
					ev.splitPath,
					codecs,
				);
				if (translation.kind === "Translated") {
					out.push(translation.action);
				} else if (translation.kind === "Invalid") {
					createDiagnostics.push(translation.diagnostic);
				}
				break;
			}
			case MaterializedEventType.Delete: {
				if (isCodexEvent(ev, codecs)) break;
				out.push(...traslateDeleteMaterializedEvent(ev, codecs));
				break;
			}

			case MaterializedEventType.Rename: {
				if (isCodexEvent(ev, codecs)) break;
				const translation = traslateRenameMaterializedEvent(ev, codecs);
				out.push(...translation.actions);
				issues.push(...translation.issues);
				break;
			}

			default: {
				break;
			}
		}
	}

	return { createDiagnostics, issues, treeActions: out };
};

/**
 * Check if an observed event targets a generated Codex basename.
 */
function isCodexEvent(ev: MaterializedNodeEvent, codecs: Codecs): boolean {
	const splitPath =
		ev.kind === MaterializedEventType.Rename ? ev.to : ev.splitPath;
	const result = Result.mapError(
		codecs.suffix.parseSeparatedSuffix(splitPath.basename),
		(error) => error.message,
	);
	return (
		Result.isSuccess(result) && result.success.coreName === PREFIX_OF_CODEX
	);
}
