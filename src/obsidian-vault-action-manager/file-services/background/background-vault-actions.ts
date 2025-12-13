import { z } from "zod";
import type { PrettyPath } from "../../../../types/common-interface/dtos";

const UPDATE_OR_CREATE = "UpdateOrCreate" as const;
const TRASH = "Trash" as const;
const RENAME = "Rename" as const;
const PROCESS = "Process" as const;
const WRITE = "Write" as const;
const FILE = "File" as const;
const FOLDER = "Folder" as const;

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

export const LegacyVaultActionTypeSchema = z.enum([
	...DirActionTypeValues,
	...ContentActionTypeValues,
] as const);

export const LegacyVaultActionType = LegacyVaultActionTypeSchema.enum;
export type LegacyVaultActionType = z.infer<typeof LegacyVaultActionTypeSchema>;

// Action payloads
export type LegacyVaultAction =
	| {
			type: typeof LegacyVaultActionType.UpdateOrCreateFolder;
			payload: { prettyPath: PrettyPath };
	  }
	| {
			type: typeof LegacyVaultActionType.RenameFolder;
			payload: { from: PrettyPath; to: PrettyPath };
	  }
	| {
			type: typeof LegacyVaultActionType.TrashFolder;
			payload: { prettyPath: PrettyPath };
	  }
	| {
			type: typeof LegacyVaultActionType.UpdateOrCreateFile;
			payload: { prettyPath: PrettyPath; content?: string };
	  }
	| {
			type: typeof LegacyVaultActionType.RenameFile;
			payload: { from: PrettyPath; to: PrettyPath };
	  }
	| {
			type: typeof LegacyVaultActionType.TrashFile;
			payload: { prettyPath: PrettyPath };
	  }
	| {
			type: typeof LegacyVaultActionType.ProcessFile;
			payload: {
				prettyPath: PrettyPath;
				transform: (content: string) => string | Promise<string>;
			};
	  }
	| {
			type: typeof LegacyVaultActionType.WriteFile;
			payload: { prettyPath: PrettyPath; content: string };
	  };

// Execution order weights (lower = execute first)
export const weightForVaultActionType: Record<LegacyVaultActionType, number> = {
	// Folders first (must exist before files can be created in them)
	[LegacyVaultActionType.UpdateOrCreateFolder]: 0,
	[LegacyVaultActionType.RenameFolder]: 1,
	[LegacyVaultActionType.TrashFolder]: 2,

	// Files second
	[LegacyVaultActionType.UpdateOrCreateFile]: 3,
	[LegacyVaultActionType.RenameFile]: 4,
	[LegacyVaultActionType.TrashFile]: 5,

	// Content operations last (file must exist)
	[LegacyVaultActionType.ProcessFile]: 6,
	[LegacyVaultActionType.WriteFile]: 7,
} as const;

/**
 * Get a unique key for an action based on its target path.
 * Used for deduplication in the queue.
 */
export function getActionKey(action: LegacyVaultAction): string {
	const { type, payload } = action;

	switch (type) {
		case LegacyVaultActionType.UpdateOrCreateFolder:
		case LegacyVaultActionType.TrashFolder:
		case LegacyVaultActionType.UpdateOrCreateFile:
		case LegacyVaultActionType.TrashFile:
		case LegacyVaultActionType.ProcessFile:
		case LegacyVaultActionType.WriteFile:
			return `${type}:${prettyPathToKey(payload.prettyPath)}`;

		case LegacyVaultActionType.RenameFolder:
		case LegacyVaultActionType.RenameFile:
			// For renames, key by source path to dedupe multiple renames of same file
			return `${type}:${prettyPathToKey(payload.from)}`;
		default:
			return unreachable(type);
	}
}

/**
 * Get the target path of an action (for logging/debugging).
 */
export function getActionTargetPath(action: LegacyVaultAction): string {
	const { type, payload } = action;

	switch (type) {
		case LegacyVaultActionType.UpdateOrCreateFolder:
		case LegacyVaultActionType.TrashFolder:
		case LegacyVaultActionType.UpdateOrCreateFile:
		case LegacyVaultActionType.TrashFile:
		case LegacyVaultActionType.ProcessFile:
		case LegacyVaultActionType.WriteFile:
			return prettyPathToKey(payload.prettyPath);

		case LegacyVaultActionType.RenameFolder:
		case LegacyVaultActionType.RenameFile:
			return `${prettyPathToKey(payload.from)} → ${prettyPathToKey(payload.to)}`;
		default:
			return unreachable(type);
	}
}

function prettyPathToKey(prettyPath: PrettyPath): string {
	return [...prettyPath.pathParts, prettyPath.basename].join("/");
}

function unreachable(x: never): never {
	throw new Error(`Unhandled action type: ${String(x)}`);
}

/**
 * Sort actions by execution weight.
 */
export function sortActionsByWeight(
	actions: LegacyVaultAction[],
): LegacyVaultAction[] {
	const pathDepth = (action: LegacyVaultAction): number => {
		switch (action.type) {
			case LegacyVaultActionType.UpdateOrCreateFolder:
			case LegacyVaultActionType.TrashFolder:
				return action.payload.prettyPath.pathParts.length;
			case LegacyVaultActionType.RenameFolder:
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
