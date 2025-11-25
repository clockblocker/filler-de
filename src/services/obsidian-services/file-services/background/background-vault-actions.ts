import { z } from "zod";
import type { PrettyPath } from "../../../../types/common-interface/dtos";
import {
	CREATE,
	FILE,
	FOLDER,
	PROCESS,
	READ,
	RENAME,
	TRASH,
	WRITE,
} from "../../../../types/literals";

// Action type schema construction
export const DirActionSchema = z.enum([CREATE, TRASH, RENAME] as const);
export const ContentActionSchema = z.enum([PROCESS, READ, WRITE] as const);
export const AbstractFileTypeSchema = z.enum([FILE, FOLDER] as const);
const AbstractFileType = AbstractFileTypeSchema.enum;

const DirActionTypeValues = DirActionSchema.options.flatMap((action) =>
	AbstractFileTypeSchema.options.map(
		(entity) => `${action}${entity}` as const,
	),
);

const ContentActionTypeValues = ContentActionSchema.options.map(
	(c) => `${c}${AbstractFileType.File}` as const,
);

export const BackgroundVaultActionTypeSchema = z.enum([
	...DirActionTypeValues,
	...ContentActionTypeValues,
] as const);

export const BackgroundVaultActionType = BackgroundVaultActionTypeSchema.enum;
export type BackgroundVaultActionType = z.infer<
	typeof BackgroundVaultActionTypeSchema
>;

// Action payloads
export type BackgroundVaultAction =
	| {
			type: typeof BackgroundVaultActionType.CreateFolder;
			payload: { prettyPath: PrettyPath };
	  }
	| {
			type: typeof BackgroundVaultActionType.RenameFolder;
			payload: { from: PrettyPath; to: PrettyPath };
	  }
	| {
			type: typeof BackgroundVaultActionType.TrashFolder;
			payload: { prettyPath: PrettyPath };
	  }
	| {
			type: typeof BackgroundVaultActionType.CreateFile;
			payload: { prettyPath: PrettyPath; content?: string };
	  }
	| {
			type: typeof BackgroundVaultActionType.RenameFile;
			payload: { from: PrettyPath; to: PrettyPath };
	  }
	| {
			type: typeof BackgroundVaultActionType.TrashFile;
			payload: { prettyPath: PrettyPath };
	  }
	| {
			type: typeof BackgroundVaultActionType.ProcessFile;
			payload: {
				prettyPath: PrettyPath;
				transform: (content: string) => string | Promise<string>;
			};
	  }
	| {
			type: typeof BackgroundVaultActionType.ReadFile;
			payload: { prettyPath: PrettyPath };
	  }
	| {
			type: typeof BackgroundVaultActionType.WriteFile;
			payload: { prettyPath: PrettyPath; content: string };
	  };

// Execution order weights (lower = execute first)
export const weightForVaultActionType: Record<
	BackgroundVaultActionType,
	number
> = {
	// Folders first (must exist before files can be created in them)
	[BackgroundVaultActionType.CreateFolder]: 0,
	[BackgroundVaultActionType.RenameFolder]: 1,
	[BackgroundVaultActionType.TrashFolder]: 2,

	// Files second
	[BackgroundVaultActionType.CreateFile]: 3,
	[BackgroundVaultActionType.RenameFile]: 4,
	[BackgroundVaultActionType.TrashFile]: 5,

	// Content operations last (file must exist)
	[BackgroundVaultActionType.ProcessFile]: 6,
	[BackgroundVaultActionType.WriteFile]: 7,
	[BackgroundVaultActionType.ReadFile]: 8,
} as const;

/**
 * Get a unique key for an action based on its target path.
 * Used for deduplication in the queue.
 */
export function getActionKey(action: BackgroundVaultAction): string {
	const { type, payload } = action;

	switch (type) {
		case BackgroundVaultActionType.CreateFolder:
		case BackgroundVaultActionType.TrashFolder:
		case BackgroundVaultActionType.CreateFile:
		case BackgroundVaultActionType.TrashFile:
		case BackgroundVaultActionType.ProcessFile:
		case BackgroundVaultActionType.ReadFile:
		case BackgroundVaultActionType.WriteFile:
			return `${type}:${prettyPathToKey(payload.prettyPath)}`;

		case BackgroundVaultActionType.RenameFolder:
		case BackgroundVaultActionType.RenameFile:
			// For renames, key by source path to dedupe multiple renames of same file
			return `${type}:${prettyPathToKey(payload.from)}`;
	}
}

/**
 * Get the target path of an action (for logging/debugging).
 */
export function getActionTargetPath(action: BackgroundVaultAction): string {
	const { type, payload } = action;

	switch (type) {
		case BackgroundVaultActionType.CreateFolder:
		case BackgroundVaultActionType.TrashFolder:
		case BackgroundVaultActionType.CreateFile:
		case BackgroundVaultActionType.TrashFile:
		case BackgroundVaultActionType.ProcessFile:
		case BackgroundVaultActionType.ReadFile:
		case BackgroundVaultActionType.WriteFile:
			return prettyPathToKey(payload.prettyPath);

		case BackgroundVaultActionType.RenameFolder:
		case BackgroundVaultActionType.RenameFile:
			return `${prettyPathToKey(payload.from)} → ${prettyPathToKey(payload.to)}`;
	}
}

function prettyPathToKey(prettyPath: PrettyPath): string {
	return [...prettyPath.pathParts, prettyPath.basename].join("/");
}

/**
 * Sort actions by execution weight.
 */
export function sortActionsByWeight(
	actions: BackgroundVaultAction[],
): BackgroundVaultAction[] {
	return [...actions].sort(
		(a, b) =>
			weightForVaultActionType[a.type] - weightForVaultActionType[b.type],
	);
}
