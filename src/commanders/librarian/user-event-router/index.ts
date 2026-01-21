export {
	UserEventRouter,
	type UserEventRouterDeps,
	type UserEvent,
} from "./user-event-router";
export { handleWikilinkCompleted } from "./handlers/wikilink-handler";
export { handleClipboardCopy } from "./handlers/clipboard-handler";
export {
	handleSelectAll,
	calculateSmartRange,
} from "./handlers/select-all-handler";
export {
	handleCheckboxClick,
	handlePropertyCheckboxClick,
	type CheckboxHandlerResult,
} from "./handlers/checkbox-handler";
