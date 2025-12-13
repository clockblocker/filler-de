// ─── Vault Action Definitions (moved here for platform boundary) ───

import z from "zod";
import {
	CREATE,
	FILE,
	FOLDER,
	MD_FILE,
	PROCESS,
	RENAME,
	REWRITE,
	TRASH,
} from "./literals";
import type { CoreSplitPath, SplitPathToMdFile } from "./split-path";

const OperationSchema = z.enum([CREATE, RENAME, TRASH] as const);

const TargetSchema = z.enum([FOLDER, FILE, MD_FILE] as const);
const Target = TargetSchema.enum;

const ContentOpsSchema = z.enum([PROCESS, REWRITE] as const);

export const VaultActionTypeSchema = z.enum([
	...OperationSchema.options.flatMap((op) =>
		TargetSchema.options.map((target) => `${op}${target}` as const),
	),
	...ContentOpsSchema.options.map((op) => `${op}${Target.MdFile}` as const),
] as const);

export const VaultActionType = VaultActionTypeSchema.enum;
export type VaultActionType = z.infer<typeof VaultActionTypeSchema>;

export type Transform = (content: string) => string | Promise<string>;

type RenamePayload = { from: CoreSplitPath; to: CoreSplitPath };
type CreatePayload = { splitPath: CoreSplitPath; content?: string };
type TrashPayload = { splitPath: CoreSplitPath };
type ProcessPayload = {
	splitPath: SplitPathToMdFile;
	transform: Transform;
};
type RewritePayload = { splitPath: CoreSplitPath; content: string };

export type VaultAction =
	| { type: typeof VaultActionType.CreateFolder; payload: CreatePayload }
	| { type: typeof VaultActionType.RenameFolder; payload: RenamePayload }
	| { type: typeof VaultActionType.TrashFolder; payload: TrashPayload }
	| { type: typeof VaultActionType.CreateFile; payload: CreatePayload }
	| { type: typeof VaultActionType.RenameFile; payload: RenamePayload }
	| { type: typeof VaultActionType.TrashFile; payload: TrashPayload }
	| { type: typeof VaultActionType.CreateMdFile; payload: CreatePayload }
	| { type: typeof VaultActionType.RenameMdFile; payload: RenamePayload }
	| { type: typeof VaultActionType.TrashMdFile; payload: TrashPayload }
	| { type: typeof VaultActionType.ProcessMdFile; payload: ProcessPayload }
	| { type: typeof VaultActionType.RewriteMdFile; payload: RewritePayload };

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
	[VaultActionType.RewriteMdFile]: 10,
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
		case VaultActionType.RewriteMdFile:
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
		case VaultActionType.RewriteMdFile:
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

function coreSplitPathToKey(splitPath: CoreSplitPath): string {
	return [...splitPath.pathParts, splitPath.basename].join("/");
}
