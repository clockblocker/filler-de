/**
 * WikilinkCodec - encodes wikilink completion data into payload.
 */

import type { EditorView } from "@codemirror/view";
import type { UserEffectFor } from "../../contracts";
import { createEventCodec } from "../codec-factory";
import type { CompletedLink } from "./link-at";
import type { InternalWikilinkPayload } from "./payload";
import { createWikilinkPayload } from "./payload";

type WikilinkData = {
	link: CompletedLink;
	view: EditorView;
};

/**
 * Whether the editor still holds the link the payload was made from: an
 * edit made before the handler answered moves or changes it, and then the
 * effect is dropped rather than written over other text.
 */
function stillThere(payload: InternalWikilinkPayload): boolean {
	const { state } = payload.view;
	return (
		state.sliceDoc(payload.contentFrom - 2, payload.contentFrom) === "[[" &&
		state.sliceDoc(payload.closePos, payload.closePos + 2) === "]]" &&
		state.sliceDoc(payload.contentFrom, payload.closePos).trim() ===
			payload.linkContent
	);
}

export const WikilinkCodec = createEventCodec(
	/**
	 * Encode wikilink data into a payload.
	 */
	(data: WikilinkData): InternalWikilinkPayload =>
		createWikilinkPayload(data.link, data.view),
	{
		/**
		 * Insert alias at closePos.
		 */
		insertAlias(
			payload: InternalWikilinkPayload,
			effect: Extract<
				UserEffectFor<"WikilinkCompleted">,
				{ aliasToInsert: string; resolvedTarget?: never }
			>,
		): void {
			if (!stillThere(payload)) return;
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
				UserEffectFor<"WikilinkCompleted">,
				{ resolvedTarget: string }
			>,
		): void {
			if (!stillThere(payload)) return;
			const alias = effect.aliasToInsert;
			const insert = alias
				? `${effect.resolvedTarget}|${alias}`
				: effect.resolvedTarget;

			payload.view.dispatch({
				changes: {
					from: payload.contentFrom,
					insert,
					to: payload.closePos,
				},
			});
		},
	},
);
