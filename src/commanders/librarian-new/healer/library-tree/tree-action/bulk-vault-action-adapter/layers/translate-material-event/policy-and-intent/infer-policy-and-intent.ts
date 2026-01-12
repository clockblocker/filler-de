import type { Codecs } from "../../../../codecs";
import {
	MaterializedEventType,
	type MaterializedNodeEvent,
} from "../../materialized-node-events";
import { inferRenameIntent } from "./intent/infer-intent";
import { RenameIntent } from "./intent/types";
import { inferCreatePolicy } from "./policy/infer-create";
import { inferMovePolicy } from "./policy/infer-move";
import { ChangePolicy } from "./policy/types";

export const inferPolicyAndIntent = (
	e: MaterializedNodeEvent,
	codecs: Codecs,
): {
	policy: ChangePolicy;
	intent?: RenameIntent | undefined;
} => {
	switch (e.kind) {
		case MaterializedEventType.Create: {
			return {
				intent: undefined,
				policy: inferCreatePolicy(e.splitPath),
			};
		}

		case MaterializedEventType.Delete: {
			// delete doesn't canonicalize via policy; keep something deterministic
			return {
				intent: undefined,
				policy: ChangePolicy.PathKing,
			};
		}

		case MaterializedEventType.Rename: {
			const intent = inferRenameIntent(e, codecs);
			const movePolicy = inferMovePolicy(e);

			// intent=Rename => force PathKing, else use movePolicy
			const policy =
				intent === RenameIntent.Rename
					? ChangePolicy.PathKing
					: movePolicy;

			return { intent, policy };
		}
	}
};
