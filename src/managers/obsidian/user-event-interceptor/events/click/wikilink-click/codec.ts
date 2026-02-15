/**
 * WikilinkClickCodec - encodes wikilink click data into payload.
 */

import type { SplitPathToMdFile } from "../../../../vault-action-manager/types/split-path";
import { createEventCodec } from "../../codec-factory";
import type { Modifiers, WikilinkClickPayload, WikiTarget } from "./payload";
import { createWikilinkClickPayload } from "./payload";

export type WikilinkClickData = {
	wikiTarget: WikiTarget;
	blockContent: string;
	splitPath: SplitPathToMdFile;
	modifiers: Modifiers;
};

export const WikilinkClickCodec = createEventCodec(
	/**
	 * Encode wikilink click data into a payload.
	 */
	(data: WikilinkClickData): WikilinkClickPayload =>
		createWikilinkClickPayload(
			data.wikiTarget,
			data.blockContent,
			data.splitPath,
			data.modifiers,
		),
);
