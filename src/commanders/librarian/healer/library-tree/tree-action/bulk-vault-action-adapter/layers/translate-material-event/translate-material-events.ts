import type { Codecs } from "../../../../../../codecs";
import { CODEX_CORE_NAME } from "../../../../codex/literals";
import type { TreeAction } from "../../../types/tree-action";
import {
	MaterializedEventType,
	type MaterializedNodeEvent,
} from "../materialized-node-events";
import { adaptCodecResult } from "./error-adapters";
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
	codecs: Codecs,
): TreeAction[] => {
	const out: TreeAction[] = [];

	for (const ev of events) {
		if (isCodexEvent(ev, codecs)) continue;

		switch (ev.kind) {
			case MaterializedEventType.Create: {
				out.push(...traslateCreateMaterializedEvent(ev, codecs));
				break;
			}
			case MaterializedEventType.Delete: {
				out.push(...traslateDeleteMaterializedEvent(ev, codecs));
				break;
			}

			case MaterializedEventType.Rename: {
				out.push(...traslateRenameMaterializedEvent(ev, codecs));
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
function isCodexEvent(ev: MaterializedNodeEvent, codecs: Codecs): boolean {
	const splitPath =
		ev.kind === MaterializedEventType.Rename ? ev.to : ev.splitPath;
	const result = adaptCodecResult(
		codecs.suffix.parseSeparatedSuffix(splitPath.basename),
	);
	return result.isOk() && result.value.coreName === CODEX_CORE_NAME;
}
