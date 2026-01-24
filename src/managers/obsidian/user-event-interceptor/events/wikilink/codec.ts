/**
 * WikilinkCodec - encodes wikilink completion data into payload.
 */

import type { EditorView } from "@codemirror/view";
import type { WikilinkPayload } from "./payload";
import { createWikilinkPayload } from "./payload";

export type WikilinkData = {
	linkContent: string;
	closePos: number;
	view: EditorView;
};

export const WikilinkCodec = {
	/**
	 * Encode wikilink data into a payload.
	 */
	encode(data: WikilinkData): WikilinkPayload {
		return createWikilinkPayload(
			data.linkContent,
			data.closePos,
			data.view,
		);
	},

	/**
	 * Insert alias at closePos if set in payload.
	 */
	insertAlias(payload: WikilinkPayload): void {
		if (payload.aliasToInsert) {
			payload.view.dispatch({
				changes: {
					from: payload.closePos,
					insert: `|${payload.aliasToInsert}`,
				},
			});
		}
	},
};
