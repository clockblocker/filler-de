// ─── Vault Action Definitions (moved here for platform boundary) ───

import z from "zod";
import type { PrettyPath } from "../../types/common-interface/dtos";
import {
	FILE,
	FOLDER,
	MD_FILE,
	PROCESS,
	RENAME,
	TRASH,
	UPDATE_OR_CREATE,
	WRITE,
} from "./literals";

export const ContentActionSchema = z.enum([PROCESS, WRITE] as const);
export const AbstractFileTypeSchema = z.enum([FILE, FOLDER, MD_FILE] as const);
const AbstractFileType = AbstractFileTypeSchema.enum;

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

export const weightForVaultActionType: Record<VaultActionType, number> = {
	[VaultActionType.UpdateOrCreateFolder]: 0,
	[VaultActionType.RenameFolder]: 1,
	[VaultActionType.TrashFolder]: 2,
	[VaultActionType.UpdateOrCreateFile]: 3,
	[VaultActionType.RenameFile]: 4,
	[VaultActionType.TrashFile]: 5,
	[VaultActionType.ProcessFile]: 6,
	[VaultActionType.WriteFile]: 7,
} as const;

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
			return `${type}:${prettyPathToKey(payload.from)}`;
	}
}

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

		const depthDelta = pathDepth(a) - pathDepth(b);
		return depthDelta;
	});
}

function prettyPathToKey(prettyPath: PrettyPath): string {
	return [...prettyPath.pathParts, prettyPath.basename].join("/");
}
