/**
 * WikilinkClickCodec - encodes wikilink click data into payload.
 */

import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { createEventCodec } from "../../codec-factory";
import type { WikilinkClickPayload, WikiTarget } from "./payload";
import { createWikilinkClickPayload } from "./payload";

type WikilinkClickData = {
	wikiTarget: WikiTarget;
	blockContent: string;
	splitPath: SplitPathToMdFile;
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
		),
);
