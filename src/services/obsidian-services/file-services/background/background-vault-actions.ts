import { z } from "zod";
import type { PrettyPath } from "../../../../types/common-interface/dtos";
import {
	FILE,
	FOLDER,
	PROCESS,
	RENAME,
	TRASH,
	UPDATE_OR_CREATE,
	WRITE,
} from "../../../../types/literals";

export const ContentActionSchema = z.enum([PROCESS, WRITE] as const);
export const AbstractFileTypeSchema = z.enum([FILE, FOLDER] as const);
const AbstractFileType = AbstractFileTypeSchema.enum;

// Action type schema construction
export const DirActionSchema = z.enum([
	UPDATE_OR_CREATE,
	TRASH,
	RENAME,
] as const);

const DirActionTypeValues = DirActionSchema.options.flatMap((action) =>
	AbstractFileTypeSchema.options.map(
		(entity) => `${action}${entity}` as const,
	),
);

const ContentActionTypeValues = ContentActionSchema.options.map(
	(c) => `${c}${AbstractFileType.File}` as const,
);

export const VaultActionTypeSchema = z.enum([
	...DirActionTypeValues,
	...ContentActionTypeValues,
] as const);

export const VaultActionType = VaultActionTypeSchema.enum;
export type VaultActionType = z.infer<typeof VaultActionTypeSchema>;

// Action payloads
export type VaultAction =
	| {
			type: typeof VaultActionType.UpdateOrCreateFolder;
			payload: { prettyPath: PrettyPath };
	  }
	| {
			type: typeof VaultActionType.RenameFolder;
			payload: { from: PrettyPath; to: PrettyPath };
	  }
	| {
			type: typeof VaultActionType.TrashFolder;
			payload: { prettyPath: PrettyPath };
	  }
	| {
			type: typeof VaultActionType.UpdateOrCreateFile;
			payload: { prettyPath: PrettyPath; content?: string };
	  }
	| {
			type: typeof VaultActionType.RenameFile;
			payload: { from: PrettyPath; to: PrettyPath };
	  }
	| {
			type: typeof VaultActionType.TrashFile;
			payload: { prettyPath: PrettyPath };
	  }
	| {
			type: typeof VaultActionType.ProcessFile;
			payload: {
				prettyPath: PrettyPath;
				transform: (content: string) => string | Promise<string>;
			};
	  }
	| {
			type: typeof VaultActionType.WriteFile;
			payload: { prettyPath: PrettyPath; content: string };
	  };

// Execution order weights (lower = execute first)
export const weightForVaultActionType: Record<VaultActionType, number> = {
	// Folders first (must exist before files can be created in them)
	[VaultActionType.UpdateOrCreateFolder]: 0,
	[VaultActionType.RenameFolder]: 1,
	[VaultActionType.TrashFolder]: 2,

	// Files second
	[VaultActionType.UpdateOrCreateFile]: 3,
	[VaultActionType.RenameFile]: 4,
	[VaultActionType.TrashFile]: 5,

	// Content operations last (file must exist)
	[VaultActionType.ProcessFile]: 6,
	[VaultActionType.WriteFile]: 7,
} as const;

/**
 * Get a unique key for an action based on its target path.
 * Used for deduplication in the queue.
 */
export function getActionKey(action: VaultAction): string {
	const { type, payload } = action;

	switch (type) {
		case VaultActionType.UpdateOrCreateFolder:
		case VaultActionType.TrashFolder:
		case VaultActionType.UpdateOrCreateFile:
		case VaultActionType.TrashFile:
		case VaultActionType.ProcessFile:
		case VaultActionType.WriteFile:
			return `${type}:${prettyPathToKey(payload.prettyPath)}`;

		case VaultActionType.RenameFolder:
		case VaultActionType.RenameFile:
			// For renames, key by source path to dedupe multiple renames of same file
			return `${type}:${prettyPathToKey(payload.from)}`;
	}
}

/**
 * Get the target path of an action (for logging/debugging).
 */
export function getActionTargetPath(action: VaultAction): string {
	const { type, payload } = action;

	switch (type) {
		case VaultActionType.UpdateOrCreateFolder:
		case VaultActionType.TrashFolder:
		case VaultActionType.UpdateOrCreateFile:
		case VaultActionType.TrashFile:
		case VaultActionType.ProcessFile:
		case VaultActionType.WriteFile:
			return prettyPathToKey(payload.prettyPath);

		case VaultActionType.RenameFolder:
		case VaultActionType.RenameFile:
			return `${prettyPathToKey(payload.from)} → ${prettyPathToKey(payload.to)}`;
	}
}

function prettyPathToKey(prettyPath: PrettyPath): string {
	return [...prettyPath.pathParts, prettyPath.basename].join("/");
}

/**
 * Sort actions by execution weight.
 */
export function sortActionsByWeight(actions: VaultAction[]): VaultAction[] {
	const pathDepth = (action: VaultAction): number => {
		switch (action.type) {
			case VaultActionType.UpdateOrCreateFolder:
			case VaultActionType.TrashFolder:
				return action.payload.prettyPath.pathParts.length;
			case VaultActionType.RenameFolder:
				return action.payload.to.pathParts.length;
			default:
				return 0;
		}
	};

	return [...actions].sort((a, b) => {
		const weightDelta =
			weightForVaultActionType[a.type] - weightForVaultActionType[b.type];
		if (weightDelta !== 0) return weightDelta;

		// Within same weight, ensure parent folders before children
		const depthDelta = pathDepth(a) - pathDepth(b);
		return depthDelta;
	});
}
