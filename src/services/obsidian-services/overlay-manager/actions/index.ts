// Re-export from parent level (not moved to avoid breaking changes)
export { executeAction, getExecutor } from "../executor-registry";
export { LibrarianActionProvider } from "../librarian-action-provider";
export {
	type ClickDispatcherDeps,
	handleActionClick,
	setupDelegatedClickHandler,
} from "./action-click-dispatcher";
