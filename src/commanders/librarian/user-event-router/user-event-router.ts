import type {
	CheckboxClickedEvent,
	ClipboardCopyEvent,
	PropertyCheckboxClickedEvent,
	SelectAllEvent,
	WikilinkCompletedEvent,
} from "../../../managers/obsidian/user-event-interceptor";
import { InterceptableUserEventKind } from "../../../managers/obsidian/user-event-interceptor/types/user-event";
import type { CodecRules, Codecs } from "../codecs";
import type { TreeAction } from "../healer/library-tree/tree-action/types/tree-action";
import {
	handleCheckboxClick,
	handlePropertyCheckboxClick,
} from "./handlers/checkbox-handler";
import { handleClipboardCopy } from "./handlers/clipboard-handler";
import { handleSelectAll } from "./handlers/select-all-handler";
import { handleWikilinkCompleted } from "./handlers/wikilink-handler";

/**
 * User event type union (from user-event-interceptor).
 */
export type UserEvent =
	| CheckboxClickedEvent
	| PropertyCheckboxClickedEvent
	| WikilinkCompletedEvent
	| ClipboardCopyEvent
	| SelectAllEvent;

/**
 * Dependencies for UserEventRouter.
 */
export type UserEventRouterDeps = {
	codecs: Codecs;
	rules: CodecRules;
	enqueue: (actions: TreeAction[]) => void;
};

/**
 * Routes user events to appropriate handlers.
 * Checkbox/property clicks produce TreeActions that get enqueued.
 * Other events (wikilink, clipboard, select-all) are handled inline.
 */
export class UserEventRouter {
	constructor(private readonly deps: UserEventRouterDeps) {}

	/**
	 * Handle a user event by dispatching to the appropriate handler.
	 */
	handle(event: UserEvent): void {
		switch (event.kind) {
			case InterceptableUserEventKind.CheckboxClicked:
				this.handleCheckbox(event);
				break;
			case InterceptableUserEventKind.PropertyCheckboxClicked:
				this.handlePropertyCheckbox(event);
				break;
			case InterceptableUserEventKind.WikilinkCompleted:
				handleWikilinkCompleted(event, this.deps.codecs);
				break;
			case InterceptableUserEventKind.ClipboardCopy:
				handleClipboardCopy(event);
				break;
			case InterceptableUserEventKind.SelectAll:
				handleSelectAll(event);
				break;
		}
	}

	private handleCheckbox(event: CheckboxClickedEvent): void {
		const result = handleCheckboxClick(event, this.deps.codecs);
		if (result) {
			this.deps.enqueue([result.action]);
		}
	}

	private handlePropertyCheckbox(event: PropertyCheckboxClickedEvent): void {
		const result = handlePropertyCheckboxClick(
			event,
			this.deps.codecs,
			this.deps.rules,
		);
		if (result) {
			this.deps.enqueue([result.action]);
		}
	}
}
