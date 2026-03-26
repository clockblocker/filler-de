import { makeSplitPath } from "@textfresser/vault-action-manager";
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import {
	type UserEventHandler,
	type WikilinkClickPayload,
	UserEventKind,
} from "../../../../managers/obsidian/user-event-interceptor";
import { splitPathsEqual } from "../../../../stateless-helpers/split-path-comparison";
import { buildAttestationFromWikilinkClickPayload } from "../../common/attestation/builders/build-from-wikilink-click-payload";
import type {
	InFlightGenerate,
	TextfresserState,
} from "../../state/textfresser-state";

export function createWikilinkClickHandler(params: {
	awaitGenerateAndScroll: (inFlight: InFlightGenerate) => Promise<void>;
	state: TextfresserState;
	vam: VaultActionManager;
}): UserEventHandler<typeof UserEventKind.WikilinkClicked> {
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
					payload.target.basename,
					makeSplitPath(payload.sourcePath) as {
						basename: string;
						extension: "md";
						kind: "MdFile";
						pathParts: string[];
					},
				);
				const isInFlightTarget = clickedTarget
					? splitPathsEqual(clickedTarget, inFlight.targetPath)
					: payload.target.basename === inFlight.targetPath.basename;
				if (isInFlightTarget) {
					void awaitGenerateAndScroll(inFlight);
				}
			}

			return { outcome: "passthrough" } as const;
		},
	};
}
