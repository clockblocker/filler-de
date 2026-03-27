/**
 * ClipboardCodec - encodes/decodes clipboard events.
 *
 * Encode: ClipboardEvent + selection → ClipboardPayload
 * Decode: ClipboardPayload → clipboard data
 */

import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import type { UserEffectFor } from "../../contracts";
import { createEventCodec } from "../codec-factory";
import type { ClipboardPayload } from "./payload";
import { createClipboardPayload } from "./payload";

export const ClipboardCodec = createEventCodec(
	/**
	 * Encode a clipboard event into a payload.
	 */
	(
		evt: ClipboardEvent,
		selection: string,
		splitPath?: SplitPathToMdFile,
	): ClipboardPayload =>
		createClipboardPayload(selection, evt.type === "cut", splitPath),
	{
		/**
		 * Apply clipboard effect to the clipboard data.
		 */
		applyEffect(
			effect: UserEffectFor<"ClipboardCopy">,
			clipboardData: DataTransfer,
		): void {
			clipboardData.setData("text/plain", effect.modifiedText);
		},
	},
);
