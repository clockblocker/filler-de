// ─── Vault Action Definitions (moved here for platform boundary) ───

import z from "zod";
import {
	CREATE,
	FILE,
	FOLDER,
	MD_FILE,
	PROCESS,
	REPLACE,
	TRASH,
	WRITE,
} from "./literals";
import type { CoreSplitPath } from "./split-path";

const OperationSchema = z.enum([CREATE, REPLACE, TRASH] as const);

const TargetSchema = z.enum([FOLDER, FILE, MD_FILE] as const);
const Target = TargetSchema.enum;

const ContentOpsSchema = z.enum([PROCESS, WRITE] as const);

export const VaultActionTypeSchema = z.enum([
	...OperationSchema.options.flatMap((op) =>
		TargetSchema.options.map((target) => `${op}${target}` as const),
	),
	...ContentOpsSchema.options.map((op) => `${op}${Target.MdFile}` as const),
] as const);

export const VaultActionType = VaultActionTypeSchema.enum;
export type VaultActionType = z.infer<typeof VaultActionTypeSchema>;

type ReplacePayload = { from: CoreSplitPath; to: CoreSplitPath };
type CreatePayload = { coreSplitPath: CoreSplitPath; content?: string };
type TrashPayload = { coreSplitPath: CoreSplitPath };
type ProcessPayload = {
	coreSplitPath: CoreSplitPath;
	transform: (content: string) => string | Promise<string>;
};
type WritePayload = { coreSplitPath: CoreSplitPath; content: string };

export type VaultAction =
	| { type: typeof VaultActionType.CreateFolder; payload: CreatePayload }
	| { type: typeof VaultActionType.ReplaceFolder; payload: ReplacePayload }
	| { type: typeof VaultActionType.TrashFolder; payload: TrashPayload }
	| { type: typeof VaultActionType.CreateFile; payload: CreatePayload }
	| { type: typeof VaultActionType.ReplaceFile; payload: ReplacePayload }
	| { type: typeof VaultActionType.TrashFile; payload: TrashPayload }
	| { type: typeof VaultActionType.CreateMdFile; payload: CreatePayload }
	| { type: typeof VaultActionType.ReplaceMdFile; payload: ReplacePayload }
	| { type: typeof VaultActionType.TrashMdFile; payload: TrashPayload }
	| { type: typeof VaultActionType.ProcessMdFile; payload: ProcessPayload }
	| { type: typeof VaultActionType.WriteMdFile; payload: WritePayload };

export const weightForVaultActionType: Record<VaultActionType, number> = {
	[VaultActionType.CreateFolder]: 0,
	[VaultActionType.ReplaceFolder]: 1,
	[VaultActionType.TrashFolder]: 2,
	[VaultActionType.CreateFile]: 3,
	[VaultActionType.ReplaceFile]: 4,
	[VaultActionType.TrashFile]: 5,
	[VaultActionType.CreateMdFile]: 6,
	[VaultActionType.ReplaceMdFile]: 7,
	[VaultActionType.TrashMdFile]: 8,
	[VaultActionType.ProcessMdFile]: 9,
	[VaultActionType.WriteMdFile]: 10,
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
		case VaultActionType.WriteMdFile:
			return `${type}:${coreSplitPathToKey(payload.coreSplitPath)}`;

		case VaultActionType.ReplaceFolder:
		case VaultActionType.ReplaceFile:
		case VaultActionType.ReplaceMdFile:
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
		case VaultActionType.WriteMdFile:
			return coreSplitPathToKey(payload.coreSplitPath);

		case VaultActionType.ReplaceFolder:
		case VaultActionType.ReplaceFile:
		case VaultActionType.ReplaceMdFile:
			return `${coreSplitPathToKey(payload.from)} → ${coreSplitPathToKey(payload.to)}`;
	}
}

export function sortActionsByWeight(actions: VaultAction[]): VaultAction[] {
	const pathDepth = (action: VaultAction): number => {
		switch (action.type) {
			case VaultActionType.CreateFolder:
			case VaultActionType.TrashFolder:
				return action.payload.coreSplitPath.pathParts.length;
			case VaultActionType.ReplaceFolder:
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

function coreSplitPathToKey(coreSplitPath: CoreSplitPath): string {
	return [...coreSplitPath.pathParts, coreSplitPath.basename].join("/");
}
