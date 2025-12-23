import type { DependencyGraph } from "../types/dependency";
import type { VaultAction } from "../types/vault-action";
import { getActionKey, VaultActionType } from "../types/vault-action";

/**
 * Topological sort using Kahn's algorithm.
 *
 * Within each dependency level, sort by path depth (shallow first).
 * This ensures parent folders are created before children when there are no explicit dependencies.
 *
 * Returns sorted actions respecting dependencies.
 * Throws error if cycle detected (shouldn't happen for file ops).
 */
export function topologicalSort(
	actions: VaultAction[],
	graph: DependencyGraph,
): VaultAction[] {
	if (actions.length === 0) {
		return [];
	}

	// Build in-degree map (how many dependencies each action has)
	const inDegree = new Map<string, number>();
	for (const action of actions) {
		const key = getActionKey(action);
		const deps = graph.get(key);
		inDegree.set(key, deps?.dependsOn.length ?? 0);
	}

	// Find actions with no dependencies (starting points)
	const queue: VaultAction[] = [];
	for (const action of actions) {
		const key = getActionKey(action);
		if ((inDegree.get(key) ?? 0) === 0) {
			queue.push(action);
		}
	}

	// Sort queue by path depth (tie-breaking within same dependency level)
	sortQueue(queue);

	const sorted: VaultAction[] = [];
	const processed = new Set<string>();

	// Process level by level
	while (queue.length > 0) {
		const action = queue.shift();
		if (!action) break;

		const key = getActionKey(action);
		if (processed.has(key)) {
			continue; // Already processed
		}

		sorted.push(action);
		processed.add(key);

		// Find actions that depend on this one and reduce their in-degree
		const deps = graph.get(key);
		if (deps) {
			for (const dependent of deps.requiredBy) {
				const depKey = getActionKey(dependent);
				const currentInDegree = inDegree.get(depKey) ?? 0;
				const newInDegree = Math.max(0, currentInDegree - 1);
				inDegree.set(depKey, newInDegree);

				// If all dependencies satisfied, add to queue
				if (newInDegree === 0 && !processed.has(depKey)) {
					queue.push(dependent);
					// Re-sort queue after adding new items
					sortQueue(queue);
				}
			}
		}
	}

	// Check for cycles (unprocessed actions = cycle)
	if (sorted.length !== actions.length) {
		const unprocessed = actions.filter(
			(a) => !processed.has(getActionKey(a)),
		);
		throw new Error(
			`Cycle detected in dependency graph. Unprocessed actions: ${unprocessed.map((a) => getActionKey(a)).join(", ")}`,
		);
	}

	return sorted;
}

/**
 * Sort queue by path depth (shallow first).
 * Used for tie-breaking within same dependency level.
 * Ensures parent folders are created before children when there are no explicit dependencies.
 */
function sortQueue(queue: VaultAction[]): void {
	queue.sort((a, b) => {
		const depthA = getPathDepth(a);
		const depthB = getPathDepth(b);
		return depthA - depthB;
	});
}

/**
 * Get path depth for an action (number of path parts).
 */
function getPathDepth(action: VaultAction): number {
	switch (action.type) {
		case VaultActionType.CreateFolder:
		case VaultActionType.TrashFolder:
			return action.payload.splitPath.pathParts.length;
		case VaultActionType.RenameFolder:
			return action.payload.to.pathParts.length;
		case VaultActionType.CreateFile:
		case VaultActionType.TrashFile:
		case VaultActionType.CreateMdFile:
		case VaultActionType.TrashMdFile:
		case VaultActionType.ProcessMdFile:
		case VaultActionType.ReplaceContentMdFile:
			return action.payload.splitPath.pathParts.length;
		case VaultActionType.RenameFile:
		case VaultActionType.RenameMdFile:
			return action.payload.to.pathParts.length;
	}
}
