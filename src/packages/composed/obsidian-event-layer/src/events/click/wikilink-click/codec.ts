/**
 * WikilinkClickCodec - encodes wikilink click data into payload.
 */

import type { UserEventPayloadMap } from "../../../contracts";
import type { WikilinkClickKind, WikiTarget } from "./payload";
import { createWikilinkClickPayload } from "./payload";

type WikilinkClickData<K extends WikilinkClickKind> = {
	kind: K;
	wikiTarget: WikiTarget;
	blockContent: string;
	/** The note the link stands in. */
	sourcePath: string;
	/** Where the link stands in the note's text, when it can be told. */
	offset: number | undefined;
};

/** Generic in the click's kind, which `createEventCodec`'s encoder cannot be. */
export const WikilinkClickCodec = {
	/** Encode wikilink click data into the payload of its kind. */
	encode: <K extends WikilinkClickKind>(
		data: WikilinkClickData<K>,
	): UserEventPayloadMap[K] =>
		createWikilinkClickPayload(
			data.kind,
			data.wikiTarget,
			data.blockContent,
			data.sourcePath,
			data.offset,
		),
};
