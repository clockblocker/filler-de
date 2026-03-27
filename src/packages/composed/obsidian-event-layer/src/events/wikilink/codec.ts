/**
 * WikilinkCodec - encodes wikilink completion data into payload.
 */

import type { EditorView } from "@codemirror/view";
import type { EffectFor } from "../../contracts";
import { createEventCodec } from "../codec-factory";
import type { InternalWikilinkPayload, WikilinkPayload } from "./payload";
import { createWikilinkPayload } from "./payload";

export type WikilinkData = {
	linkContent: string;
	closePos: number;
	view: EditorView;
};

export const WikilinkCodec = createEventCodec(
	/**
	 * Encode wikilink data into a payload.
	 */
	(data: WikilinkData): InternalWikilinkPayload =>
		createWikilinkPayload(data.linkContent, data.closePos, data.view),
	{
		/**
		 * Insert alias at closePos.
		 */
		insertAlias(
			payload: InternalWikilinkPayload,
			effect: Extract<
				EffectFor<"WikilinkCompleted">,
				{ aliasToInsert: string; resolvedTarget?: never }
			>,
		): void {
			payload.view.dispatch({
				changes: {
					from: payload.closePos,
					insert: `|${effect.aliasToInsert}`,
				},
			});
		},

		/**
		 * Replace link content with resolved target + alias.
		 * Replaces the text between [[ and ]] with "resolvedTarget|aliasToInsert".
		 */
		replaceTarget(
			payload: InternalWikilinkPayload,
			effect: Extract<
				EffectFor<"WikilinkCompleted">,
				{ resolvedTarget: string }
			>,
		): void {
			const from = payload.closePos - payload.linkContent.length;
			const to = payload.closePos;
			const alias = effect.aliasToInsert;
			const insert = alias
				? `${effect.resolvedTarget}|${alias}`
				: effect.resolvedTarget;

			payload.view.dispatch({
				changes: { from, insert, to },
			});
		},
	},
);
