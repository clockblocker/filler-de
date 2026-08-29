import type {
	UserEventHandler,
	UserEventKind,
} from "@textfresser/obsidian-event-layer";
import type { VaultActionManager } from "@textfresser/vault-action-manager";
import { splitPathCodec } from "@textfresser/vault-action-manager";
import { Effect } from "effect";
import { splitPathsEqual } from "../../../../stateless-helpers/split-path-comparison";
import { buildAttestationFromWikilinkClickPayload } from "../../common/attestation/builders/build-from-wikilink-click-payload";
import type {
	InFlightGenerate,
	TextfresserState,
} from "../../state/textfresser-state";

export function createWikilinkClickHandler(params: {
	awaitGenerateAndScroll: (inFlight: InFlightGenerate) => Effect.Effect<void>;
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
				const clickedTargetProgram = vam
					.resolveLinkpathDest(
						payload.target.basename,
						splitPathCodec.parse(payload.sourcePath) as {
							basename: string;
							extension: "md";
							kind: "MdFile";
							pathParts: string[];
						},
					)
					.pipe(
						Effect.catch(() => Effect.succeed(null)),
						Effect.flatMap((clickedTarget) => {
							const isInFlightTarget = clickedTarget
								? splitPathsEqual(
										clickedTarget,
										inFlight.targetPath,
									)
								: payload.target.basename ===
									inFlight.targetPath.basename;
							return isInFlightTarget
								? awaitGenerateAndScroll(inFlight)
								: Effect.void;
						}),
					);
				void Effect.runPromise(clickedTargetProgram);
			}

			return { outcome: "passthrough" } as const;
		},
	};
}
