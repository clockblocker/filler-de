import { makeTextAction } from "../../../managers/actions-manager/actions/new/make-text-action";
import { navigatePageAction } from "../../../managers/actions-manager/actions/new/navigate-pages-action";
import newGenCommand from "../../../managers/actions-manager/actions/new/new-gen-command";
import { splitSelectionInBlocksAction } from "../../../managers/actions-manager/actions/new/split-selection-blocks-action";
import newTranslateSelection from "../../../managers/actions-manager/actions/new/translateSelection";
import { logger } from "../../../utils/logger";
import type { TexfresserObsidianServices } from "../interface";
import { ActionKind, type ActionParams, type CommanderAction } from "./types";

/**
 * Executor function signature.
 * Takes typed params and services, returns void or Promise<void>.
 */
type ActionExecutor<K extends ActionKind> = (
	params: ActionParams[K],
	services: Partial<TexfresserObsidianServices>,
) => void | Promise<void>;

/**
 * Registry mapping action kinds to their executors.
 * Each executor knows how to perform the action with typed params.
 */
const executors: { [K in ActionKind]: ActionExecutor<K> } = {
	[ActionKind.NavigatePage]: async (params, services) => {
		await navigatePageAction(services, params.direction);
	},

	[ActionKind.MakeText]: async (_params, services) => {
		await makeTextAction(services);
	},

	[ActionKind.SplitToPages]: async (_params, services) => {
		// Delegate to the split-to-pages command
		const { app } = services;
		if (app) {
			// biome-ignore lint/suspicious/noExplicitAny: <commands API not in official types>
			(app as any).commands.executeCommandById(
				"cbcr-text-eater-de:split-to-pages",
			);
		}
	},

	[ActionKind.TranslateSelection]: async (_params, services) => {
		const { selectionService, apiService } = services;
		if (selectionService && apiService) {
			await newTranslateSelection({ apiService, selectionService });
		}
	},

	[ActionKind.ExplainGrammar]: async (_params, services) => {
		// Uses the same command as Generate for now
		await newGenCommand(services);
	},

	[ActionKind.SplitInBlocks]: async (_params, services) => {
		await splitSelectionInBlocksAction(services);
	},

	[ActionKind.Generate]: async (_params, services) => {
		await newGenCommand(services);
	},

	[ActionKind.Custom]: async (params, _services) => {
		// Custom actions have their execute callback in params
		await params.execute();
	},
};

/**
 * Execute a commander action using the executor registry.
 * Handles both standard actions (via registry) and custom actions (inline callback).
 */
export async function executeAction(
	action: CommanderAction,
	services: Partial<TexfresserObsidianServices>,
): Promise<void> {
	const executor = executors[action.kind];
	if (!executor) {
		logger.error(`[ExecutorRegistry] Unknown action kind: ${action.kind}`);
		return;
	}

	// Type assertion needed due to discriminated union complexity
	// biome-ignore lint/suspicious/noExplicitAny: <discriminated union requires casting>
	await (executor as any)(action.params, services);
}

/**
 * Get executor for an action kind (for testing).
 */
export function getExecutor<K extends ActionKind>(
	kind: K,
): ActionExecutor<K> | undefined {
	return executors[kind] as ActionExecutor<K>;
}
