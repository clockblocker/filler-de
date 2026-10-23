/**
 * Clicks on `[data-action]` elements: toolbar buttons, edge zones and
 * overflow menu items. A disabled button takes no click.
 */
import { Effect } from "effect";
import type { EventDispatch } from "../../../internal/dispatch";
import { DomSelectors } from "../../../internal/dom-selectors";
import { PayloadKind } from "../../../types/payload-base";
import type { ClickSubscriber } from "../generic-click-detector";
import { ActionElementCodec } from "./codec";

export function actionElementClick(dispatch: EventDispatch): ClickSubscriber {
	return (target) => {
		const button = target.closest(
			DomSelectors.DATA_ACTION,
		) as HTMLElement | null;
		if (!button) return;
		if (button.hasAttribute("disabled")) return;

		const actionId = button.dataset[DomSelectors.DATA_ACTION_ATTR];
		if (!actionId) return;

		const payload = ActionElementCodec.encode({ actionId });
		const handler = dispatch.decide(
			PayloadKind.ActionElementClicked,
			payload,
		);
		if (!handler) return;

		dispatch.run(
			PayloadKind.ActionElementClicked,
			handler,
			Effect.succeed(payload),
		);
	};
}
