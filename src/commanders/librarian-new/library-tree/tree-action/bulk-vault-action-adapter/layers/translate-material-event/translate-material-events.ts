import type { TreeAction } from "../../../types/tree-action";
import {
	MaterializedEventType,
	type MaterializedNodeEvent,
} from "../materialized-node-events";
import { traslateCreateMaterializedEvent } from "./translators/translate-create-material-event";
import { traslateDeleteMaterializedEvent } from "./translators/translate-delete-material-event";
import { traslateRenameMaterializedEvent } from "./translators/traslate-move-actions";

export const translateMaterializedEvents = (
	events: MaterializedNodeEvent[],
): TreeAction[] => {
	const out: TreeAction[] = [];

	for (const ev of events) {
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
