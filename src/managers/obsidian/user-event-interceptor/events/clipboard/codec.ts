/**
 * ClipboardCodec - encodes/decodes clipboard events.
 *
 * Encode: ClipboardEvent + selection → ClipboardPayload
 * Decode: ClipboardPayload → clipboard data
 */

import type { SplitPathToMdFile } from "../../../vault-action-manager/types/split-path";
import type { ClipboardPayload } from "./payload";
import { createClipboardPayload } from "./payload";

export const ClipboardCodec = {
	/**
	 * Decode a payload back to clipboard data.
	 * Sets the clipboard data with modifiedText if present, otherwise originalText.
	 */
	decode(payload: ClipboardPayload, clipboardData: DataTransfer): void {
		const text = payload.modifiedText ?? payload.originalText;
		clipboardData.setData("text/plain", text);
	},
	/**
	 * Encode a clipboard event into a payload.
	 */
	encode(
		evt: ClipboardEvent,
		selection: string,
		splitPath?: SplitPathToMdFile,
	): ClipboardPayload {
		return createClipboardPayload(selection, evt.type === "cut", splitPath);
	},
};
