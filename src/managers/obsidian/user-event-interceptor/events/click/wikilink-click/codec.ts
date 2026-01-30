/**
 * WikilinkClickCodec - encodes wikilink click data into payload.
 */

import type { SplitPathToMdFile } from "../../../../vault-action-manager/types/split-path";
import type { Modifiers, WikilinkClickPayload } from "./payload";
import { createWikilinkClickPayload } from "./payload";

export type WikilinkClickData = {
	linkTarget: string;
	displayText: string;
	blockContent: string;
	splitPath: SplitPathToMdFile;
	modifiers: Modifiers;
};

export const WikilinkClickCodec = {
	/**
	 * Encode wikilink click data into a payload.
	 */
	encode(data: WikilinkClickData): WikilinkClickPayload {
		return createWikilinkClickPayload(
			data.linkTarget,
			data.displayText,
			data.blockContent,
			data.splitPath,
			data.modifiers,
		);
	},
};
