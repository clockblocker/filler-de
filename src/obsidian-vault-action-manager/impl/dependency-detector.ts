import type { ActionDependency, DependencyGraph } from "../types/dependency";
import type { VaultAction } from "../types/vault-action";
import {
	coreSplitPathToKey,
	getActionKey,
	VaultActionType,
} from "../types/vault-action";

/**
 * Build dependency graph from actions.
 *
 * Rules:
 * - ProcessMdFile/ReplaceContentMdFile depends on CreateMdFile for same file
 * - Rename actions depend on CreateFolder for destination parent folders
 * - CreateFolder depends on parent CreateFolder actions
 * - Trash actions have no dependencies
 */
export function buildDependencyGraph(actions: VaultAction[]): DependencyGraph {
	const graph = new Map<string, ActionDependency>();

	// Initialize graph entries for all actions
	for (const action of actions) {
		const key = getActionKey(action);
		graph.set(key, {
			action,
			dependsOn: [],
			requiredBy: [],
		});
	}

	// Build dependencies
	for (const action of actions) {
		const key = getActionKey(action);
		const deps = graph.get(key);
		if (!deps) continue;

		const dependencies = findDependenciesForAction(action, actions);
		deps.dependsOn = dependencies;

		// Update requiredBy for dependencies
		for (const dep of dependencies) {
			const depKey = getActionKey(dep);
			const depEntry = graph.get(depKey);
			if (depEntry) {
				depEntry.requiredBy.push(action);
			}
		}
	}

	return graph;
}

/**
 * Find all actions that the given action depends on.
 */
function findDependenciesForAction(
	action: VaultAction,
	allActions: VaultAction[],
): VaultAction[] {
	const dependencies: VaultAction[] = [];

	switch (action.type) {
		case VaultActionType.ProcessMdFile:
		case VaultActionType.ReplaceContentMdFile: {
			// Depends on CreateMdFile for same file
			const fileKey = coreSplitPathToKey(action.payload.splitPath);
			const createAction = allActions.find(
				(a) =>
					a.type === VaultActionType.CreateMdFile &&
					coreSplitPathToKey(a.payload.splitPath) === fileKey,
			);
			if (createAction) {
				dependencies.push(createAction);
			}
			// Also depends on parent folders
			dependencies.push(
				...findParentFolderDependencies(
					action.payload.splitPath,
					allActions,
				),
			);
			break;
		}

		case VaultActionType.CreateMdFile:
		case VaultActionType.CreateFile: {
			// Depends on parent folders only
			dependencies.push(
				...findParentFolderDependencies(
					action.payload.splitPath,
					allActions,
				),
			);
			break;
		}

		case VaultActionType.RenameFolder:
		case VaultActionType.RenameFile:
		case VaultActionType.RenameMdFile: {
			// Depends on destination parent folders
			dependencies.push(
				...findParentFolderDependencies(action.payload.to, allActions),
			);
			break;
		}

		case VaultActionType.CreateFolder: {
			// Depends on parent folders
			dependencies.push(
				...findParentFolderDependencies(
					action.payload.splitPath,
					allActions,
				),
			);
			break;
		}

		// Trash actions have no dependencies
		case VaultActionType.TrashFolder:
		case VaultActionType.TrashFile:
		case VaultActionType.TrashMdFile:
			break;
	}

	return dependencies;
}

/**
 * Find CreateFolder actions for all parent folders of the given path.
 */
function findParentFolderDependencies(
	splitPath: { pathParts: string[] },
	allActions: VaultAction[],
): VaultAction[] {
	const dependencies: VaultAction[] = [];

	// Build parent folder paths (excluding root)
	for (let i = 1; i <= splitPath.pathParts.length; i++) {
		const parentPathParts = splitPath.pathParts.slice(0, i);
		const parentKey = parentPathParts.join("/");

		// Find CreateFolder action for this parent
		const createFolder = allActions.find(
			(a) =>
				a.type === VaultActionType.CreateFolder &&
				a.payload.splitPath.pathParts.join("/") === parentKey,
		);

		if (createFolder) {
			dependencies.push(createFolder);
		}
	}

	return dependencies;
}
