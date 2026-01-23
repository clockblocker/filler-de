export {
	type CheckboxHandlerResult,
	handleCheckboxClick,
	handlePropertyCheckboxClick,
} from "./handlers/checkbox-handler";
export { handleClipboardCopy } from "./handlers/clipboard-handler";
export {
	calculateSmartRange,
	handleSelectAll,
} from "./handlers/select-all-handler";
export { handleWikilinkCompleted } from "./handlers/wikilink-handler";
export {
	type UserEvent,
	UserEventRouter,
	type UserEventRouterDeps,
} from "./user-event-router";
