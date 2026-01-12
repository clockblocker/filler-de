import type { ActionDependency, DependencyGraph } from "../../types/dependency";
import type { VaultAction } from "../../types/vault-action";
import { VaultActionKind } from "../../types/vault-action";
import { makeKeyFor } from "../common/collapse-helpers";

/**
 * Build dependency graph from actions.
 *
 * Rules:
 * - ProcessMdFile depends on UpsertMdFile for same file
 * - Rename actions depend on CreateFolder for destination parent folders
 * - CreateFolder depends on parent CreateFolder actions
 * - Trash actions have no dependencies
 */
export function buildDependencyGraph(actions: VaultAction[]): DependencyGraph {
	const graph = new Map<string, ActionDependency>();

	// --- indices (O(N)) ---
	// NOTE: these are path-based indices (not graph keys).
	const createFolderByPathKey = new Map<string, VaultAction>();
	const upsertByPathKey = new Map<string, VaultAction>();

	for (const a of actions) {
		if (a.kind === VaultActionKind.CreateFolder) {
			createFolderByPathKey.set(makeKeyFor(a.payload.splitPath), a);
		}
		if (a.kind === VaultActionKind.UpsertMdFile) {
			upsertByPathKey.set(makeKeyFor(a.payload.splitPath), a);
		}
	}

	// Initialize graph entries for all actions
	for (const action of actions) {
		const key = makeGraphKey(action);
		graph.set(key, {
			action,
			dependsOn: [],
			requiredBy: [],
		});
	}

	// Build dependencies
	for (const action of actions) {
		const key = makeGraphKey(action);
		const deps = graph.get(key);
		if (!deps) continue;

		const dependencies = findDependenciesForAction(
			action,
			createFolderByPathKey,
			upsertByPathKey,
		);

		deps.dependsOn = dependencies;

		for (const dep of dependencies) {
			const depKey = makeGraphKey(dep);
			const depEntry = graph.get(depKey);
			if (!depEntry) continue;

			if (!depEntry.requiredBy.includes(action)) {
				depEntry.requiredBy.push(action);
			}
		}
	}

	return graph;
}

function findDependenciesForAction(
	action: VaultAction,
	createFolderByPathKey: Map<string, VaultAction>,
	upsertByPathKey: Map<string, VaultAction>,
): VaultAction[] {
	const dependencies: VaultAction[] = [];

	switch (action.kind) {
		case VaultActionKind.ProcessMdFile: {
			// Depends on UpsertMdFile for same file (path-based lookup)
			const filePathKey = makeKeyFor(action.payload.splitPath);
			const upsert = upsertByPathKey.get(filePathKey);
			if (upsert) dependencies.push(upsert);

			// Also depends on parent folders
			dependencies.push(
				...findParentFolderDependencies(
					action.payload.splitPath,
					createFolderByPathKey,
				),
			);
			break;
		}

		case VaultActionKind.UpsertMdFile:
		case VaultActionKind.CreateFile: {
			dependencies.push(
				...findParentFolderDependencies(
					action.payload.splitPath,
					createFolderByPathKey,
				),
			);
			break;
		}

		case VaultActionKind.RenameFolder:
		case VaultActionKind.RenameFile:
		case VaultActionKind.RenameMdFile: {
			dependencies.push(
				...findParentFolderDependencies(
					action.payload.to,
					createFolderByPathKey,
				),
			);
			break;
		}

		case VaultActionKind.CreateFolder: {
			dependencies.push(
				...findParentFolderDependencies(
					action.payload.splitPath,
					createFolderByPathKey,
				),
			);
			break;
		}

		case VaultActionKind.TrashFolder:
		case VaultActionKind.TrashFile:
		case VaultActionKind.TrashMdFile:
			break;
	}

	return dependencies;
}

function findParentFolderDependencies(
	splitPath: { pathParts: string[]; basename: string },
	createFolderByPathKey: Map<string, VaultAction>,
): VaultAction[] {
	const dependencies: VaultAction[] = [];

	for (let i = 1; i <= splitPath.pathParts.length; i++) {
		const parentPathParts = splitPath.pathParts.slice(0, i - 1);
		const parentBasename = splitPath.pathParts[i - 1];
		if (!parentBasename) continue;

		const parentKey = makeKeyFor({
			basename: parentBasename,
			kind: "Folder",
			pathParts: parentPathParts,
		});

		const createFolder = createFolderByPathKey.get(parentKey);
		if (createFolder) dependencies.push(createFolder);
	}

	return dependencies;
}

export function makeGraphKey(action: VaultAction): string {
	switch (action.kind) {
		case VaultActionKind.RenameFolder:
		case VaultActionKind.RenameFile:
		case VaultActionKind.RenameMdFile:
			return `${action.kind}:${makeKeyFor(action.payload.from)}`;

		default:
			return `${action.kind}:${makeKeyFor(action.payload.splitPath)}`;
	}
}
