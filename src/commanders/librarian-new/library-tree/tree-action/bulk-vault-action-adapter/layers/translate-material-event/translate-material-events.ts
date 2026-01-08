import type { TreeAction } from "../../../types/tree-action";
import { tryMakeSeparatedSuffixedBasename } from "../../../utils/canonical-naming/suffix-utils/core-suffix-utils";
import { CODEX_CORE_NAME } from "../../../../codex/literals";
import {
	MaterializedEventType,
	type MaterializedNodeEvent,
} from "../materialized-node-events";
import { traslateCreateMaterializedEvent } from "./translators/translate-create-material-event";
import { traslateDeleteMaterializedEvent } from "./translators/translate-delete-material-event";
import { traslateRenameMaterializedEvent } from "./translators/traslate-rename-materila-event";

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
): TreeAction[] => {
	const out: TreeAction[] = [];

	for (const ev of events) {
		// Skip codex files (coreName === "__")
		if (isCodexEvent(ev)) continue;

		switch (ev.kind) {
			case MaterializedEventType.Create: {
				out.push(...traslateCreateMaterializedEvent(ev));
				break;
			}
			case MaterializedEventType.Delete: {
				out.push(...traslateDeleteMaterializedEvent(ev));
				break;
			}

			case MaterializedEventType.Rename: {
				out.push(...traslateRenameMaterializedEvent(ev));
				break;
			}

			default: {
				break;
			}
		}
	}

	return out;
};

/**
 * Check if event targets a codex file (coreName === "__").
 */
function isCodexEvent(ev: MaterializedNodeEvent): boolean {
	const splitPath = ev.kind === MaterializedEventType.Rename ? ev.to : ev.splitPath;
	const result = tryMakeSeparatedSuffixedBasename(splitPath);
	return result.isOk() && result.value.coreName === CODEX_CORE_NAME;
}
