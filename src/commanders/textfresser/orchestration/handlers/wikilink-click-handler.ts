import {
	type EventHandler,
	HandlerOutcome,
} from "../../../../managers/obsidian/user-event-interceptor/types/handler";
import type { WikilinkClickPayload } from "../../../../managers/obsidian/user-event-interceptor/events";
import type { VaultActionManager } from "../../../../managers/obsidian/vault-action-manager";
import { buildAttestationFromWikilinkClickPayload } from "../../common/attestation/builders/build-from-wikilink-click-payload";
import type {
	InFlightGenerate,
	TextfresserState,
} from "../../state/textfresser-state";
import { areSameSplitPath } from "../shared/split-path-utils";

export function createWikilinkClickHandler(params: {
	awaitGenerateAndScroll: (inFlight: InFlightGenerate) => Promise<void>;
	state: TextfresserState;
	vam: VaultActionManager;
}): EventHandler<WikilinkClickPayload> {
	const { awaitGenerateAndScroll, state, vam } = params;

	return {
		doesApply: () => true,
		handle: (payload) => {
			const attestationResult =
				buildAttestationFromWikilinkClickPayload(payload);

			if (attestationResult.isOk()) {
				state.attestationForLatestNavigated = attestationResult.value;
			}

			const inFlight = state.inFlightGenerate;
			if (inFlight) {
				const clickedTarget = vam.resolveLinkpathDest(
					payload.wikiTarget.basename,
					payload.splitPath,
				);
				const isInFlightTarget = clickedTarget
					? areSameSplitPath(clickedTarget, inFlight.targetPath)
					: payload.wikiTarget.basename === inFlight.targetPath.basename;
				if (isInFlightTarget) {
					void awaitGenerateAndScroll(inFlight);
				}
			}

			return { outcome: HandlerOutcome.Passthrough };
		},
	};
}
