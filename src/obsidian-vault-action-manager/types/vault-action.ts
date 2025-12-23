// ─── Vault Action Definitions (moved here for platform boundary) ───

import z from "zod";
import {
	CREATE,
	FILE,
	FOLDER,
	MD_FILE,
	PROCESS,
	RENAME,
	REPLACE_CONTENT,
	TRASH,
} from "./literals";
import type {
	SplitPath,
	SplitPathFromTo,
	SplitPathToFile,
	SplitPathToFolder,
	SplitPathToMdFile,
} from "./split-path";

const OperationSchema = z.enum([CREATE, RENAME, TRASH] as const);

const TargetSchema = z.enum([FOLDER, FILE, MD_FILE] as const);
const Target = TargetSchema.enum;

const ContentOpsSchema = z.enum([PROCESS, REPLACE_CONTENT] as const);

export const VaultActionTypeSchema = z.enum([
	...OperationSchema.options.flatMap((op) =>
		TargetSchema.options.map((target) => `${op}${target}` as const),
	),
	...ContentOpsSchema.options.map((op) => `${op}${Target.MdFile}` as const),
] as const);

export const VaultActionType = VaultActionTypeSchema.enum;
export type VaultActionType = z.infer<typeof VaultActionTypeSchema>;

export type Transform = (content: string) => string | Promise<string>;

// Folder payloads
type CreateFolderPayload = {
	splitPath: SplitPathToFolder;
	content?: string;
};
type RenameFolderPayload = SplitPathFromTo<SplitPathToFolder>;
type TrashFolderPayload = { splitPath: SplitPathToFolder };

// File payloads
type CreateFilePayload = {
	splitPath: SplitPathToFile;
	content?: string;
};
type RenameFilePayload = SplitPathFromTo<SplitPathToFile>;
type TrashFilePayload = { splitPath: SplitPathToFile };

// MdFile payloads
type CreateMdFilePayload = {
	splitPath: SplitPathToMdFile;
	content?: string;
};
type RenameMdFilePayload = SplitPathFromTo<SplitPathToMdFile>;
type TrashMdFilePayload = { splitPath: SplitPathToMdFile };
type ProcessMdFilePayload = {
	splitPath: SplitPathToMdFile;
	transform: Transform;
};
type ReplaceContentMdFilePayload = {
	splitPath: SplitPathToMdFile;
	content: string;
};

export type VaultAction =
	| {
			type: typeof VaultActionType.CreateFolder;
			payload: CreateFolderPayload;
	  }
	| {
			type: typeof VaultActionType.RenameFolder;
			payload: RenameFolderPayload;
	  }
	| { type: typeof VaultActionType.TrashFolder; payload: TrashFolderPayload }
	| { type: typeof VaultActionType.CreateFile; payload: CreateFilePayload }
	| { type: typeof VaultActionType.RenameFile; payload: RenameFilePayload }
	| { type: typeof VaultActionType.TrashFile; payload: TrashFilePayload }
	| {
			type: typeof VaultActionType.CreateMdFile;
			payload: CreateMdFilePayload;
	  }
	| {
			type: typeof VaultActionType.RenameMdFile;
			payload: RenameMdFilePayload;
	  }
	| { type: typeof VaultActionType.TrashMdFile; payload: TrashMdFilePayload }
	| {
			type: typeof VaultActionType.ProcessMdFile;
			payload: ProcessMdFilePayload;
	  }
	| {
			type: typeof VaultActionType.ReplaceContentMdFile;
			payload: ReplaceContentMdFilePayload;
	  };

export const weightForVaultActionType: Record<VaultActionType, number> = {
	[VaultActionType.CreateFolder]: 0,
	[VaultActionType.RenameFolder]: 1,
	[VaultActionType.TrashFolder]: 2,
	[VaultActionType.CreateFile]: 3,
	[VaultActionType.RenameFile]: 4,
	[VaultActionType.TrashFile]: 5,
	[VaultActionType.CreateMdFile]: 6,
	[VaultActionType.RenameMdFile]: 7,
	[VaultActionType.TrashMdFile]: 8,
	[VaultActionType.ProcessMdFile]: 9,
	[VaultActionType.ReplaceContentMdFile]: 10,
} as const;

export function getActionKey(action: VaultAction): string {
	const { type, payload } = action;

	switch (type) {
		case VaultActionType.CreateFolder:
		case VaultActionType.TrashFolder:
		case VaultActionType.CreateFile:
		case VaultActionType.TrashFile:
		case VaultActionType.CreateMdFile:
		case VaultActionType.TrashMdFile:
		case VaultActionType.ProcessMdFile:
		case VaultActionType.ReplaceContentMdFile:
			return `${type}:${coreSplitPathToKey(payload.splitPath)}`;

		case VaultActionType.RenameFolder:
		case VaultActionType.RenameFile:
		case VaultActionType.RenameMdFile:
			return `${type}:${coreSplitPathToKey(payload.from)}`;
	}
}

export function getActionTargetPath(action: VaultAction): string {
	const { type, payload } = action;

	switch (type) {
		case VaultActionType.CreateFolder:
		case VaultActionType.TrashFolder:
		case VaultActionType.CreateFile:
		case VaultActionType.TrashFile:
		case VaultActionType.CreateMdFile:
		case VaultActionType.TrashMdFile:
		case VaultActionType.ProcessMdFile:
		case VaultActionType.ReplaceContentMdFile:
			return coreSplitPathToKey(payload.splitPath);

		case VaultActionType.RenameFolder:
		case VaultActionType.RenameFile:
		case VaultActionType.RenameMdFile:
			return `${coreSplitPathToKey(payload.from)} → ${coreSplitPathToKey(payload.to)}`;
	}
}

export function sortActionsByWeight(actions: VaultAction[]): VaultAction[] {
	const pathDepth = (action: VaultAction): number => {
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
	};

	const getFileKey = (action: VaultAction): string | null => {
		switch (action.type) {
			case VaultActionType.CreateMdFile:
			case VaultActionType.ProcessMdFile:
			case VaultActionType.ReplaceContentMdFile:
				return coreSplitPathToKey(action.payload.splitPath);
			default:
				return null;
		}
	};

	// Group by weight
	const byWeight = new Map<number, VaultAction[]>();
	for (const action of actions) {
		const weight = weightForVaultActionType[action.type];
		const group = byWeight.get(weight) ?? [];
		group.push(action);
		byWeight.set(weight, group);
	}

	// Sort groups by weight, then sort each group
	const sorted: VaultAction[] = [];
	const sortedWeights = Array.from(byWeight.keys()).sort((a, b) => a - b);
	for (const weight of sortedWeights) {
		const group = byWeight.get(weight) ?? [];
		const sortedGroup = group.sort((a, b) => {
			// First sort by path depth
			const depthDiff = pathDepth(a) - pathDepth(b);
			if (depthDiff !== 0) {
				return depthDiff;
			}

			// For same file, ensure CreateMdFile comes before ProcessMdFile/ReplaceContentMdFile
			const aKey = getFileKey(a);
			const bKey = getFileKey(b);
			if (aKey && bKey && aKey === bKey) {
				// Same file - prioritize CreateMdFile
				if (a.type === VaultActionType.CreateMdFile) {
					return -1; // a comes first
				}
				if (b.type === VaultActionType.CreateMdFile) {
					return 1; // b comes first
				}
			}

			return 0; // Keep original order for same depth, different files
		});
		sorted.push(...sortedGroup);
	}

	return sorted;
}

function coreSplitPathToKey(splitPath: SplitPath): string {
	return [
		...splitPath.pathParts,
		splitPath.basename,
		// biome-ignore lint/suspicious/noExplicitAny: Key extraction
		(splitPath as any)?.extension ?? "",
	]
		.filter(Boolean)
		.join("/");
}
