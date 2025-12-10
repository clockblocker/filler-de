// ─── Vault Action Definitions (moved here for platform boundary) ───

import z from "zod";
import {
	CREATE,
	DELETE,
	FILE,
	FOLDER,
	MD_FILE,
	MOVE,
	PROCESS,
	WRITE,
} from "./literals";
import type { CoreSplitPath } from "./split-path";

const OperationSchema = z.enum([CREATE, MOVE, DELETE] as const);

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

type MovePayload = { from: CoreSplitPath; to: CoreSplitPath };
type CreatePayload = { prettyPath: CoreSplitPath; content?: string };
type DeletePayload = { prettyPath: CoreSplitPath };
type ProcessPayload = {
	prettyPath: CoreSplitPath;
	transform: (content: string) => string | Promise<string>;
};
type WritePayload = { prettyPath: CoreSplitPath; content: string };

export type VaultAction =
	| { type: typeof VaultActionType.CreateFolder; payload: CreatePayload }
	| { type: typeof VaultActionType.MoveFolder; payload: MovePayload }
	| { type: typeof VaultActionType.DeleteFolder; payload: DeletePayload }
	| { type: typeof VaultActionType.CreateFile; payload: CreatePayload }
	| { type: typeof VaultActionType.MoveFile; payload: MovePayload }
	| { type: typeof VaultActionType.DeleteFile; payload: DeletePayload }
	| { type: typeof VaultActionType.CreateMdFile; payload: CreatePayload }
	| { type: typeof VaultActionType.MoveMdFile; payload: MovePayload }
	| { type: typeof VaultActionType.DeleteMdFile; payload: DeletePayload }
	| { type: typeof VaultActionType.ProcessMdFile; payload: ProcessPayload }
	| { type: typeof VaultActionType.WriteMdFile; payload: WritePayload };

export const weightForVaultActionType: Record<VaultActionType, number> = {
	[VaultActionType.CreateFolder]: 0,
	[VaultActionType.MoveFolder]: 1,
	[VaultActionType.DeleteFolder]: 2,
	[VaultActionType.CreateFile]: 3,
	[VaultActionType.MoveFile]: 4,
	[VaultActionType.DeleteFile]: 5,
	[VaultActionType.CreateMdFile]: 6,
	[VaultActionType.MoveMdFile]: 7,
	[VaultActionType.DeleteMdFile]: 8,
	[VaultActionType.ProcessMdFile]: 9,
	[VaultActionType.WriteMdFile]: 10,
} as const;

export function getActionKey(action: VaultAction): string {
	const { type, payload } = action;

	switch (type) {
		case VaultActionType.CreateFolder:
		case VaultActionType.DeleteFolder:
		case VaultActionType.CreateFile:
		case VaultActionType.DeleteFile:
		case VaultActionType.CreateMdFile:
		case VaultActionType.DeleteMdFile:
		case VaultActionType.ProcessMdFile:
		case VaultActionType.WriteMdFile:
			return `${type}:${prettyPathToKey(payload.prettyPath)}`;

		case VaultActionType.MoveFolder:
		case VaultActionType.MoveFile:
		case VaultActionType.MoveMdFile:
			return `${type}:${prettyPathToKey(payload.from)}`;
	}
}

export function getActionTargetPath(action: VaultAction): string {
	const { type, payload } = action;

	switch (type) {
		case VaultActionType.CreateFolder:
		case VaultActionType.DeleteFolder:
		case VaultActionType.CreateFile:
		case VaultActionType.DeleteFile:
		case VaultActionType.CreateMdFile:
		case VaultActionType.DeleteMdFile:
		case VaultActionType.ProcessMdFile:
		case VaultActionType.WriteMdFile:
			return prettyPathToKey(payload.prettyPath);

		case VaultActionType.MoveFolder:
		case VaultActionType.MoveFile:
		case VaultActionType.MoveMdFile:
			return `${prettyPathToKey(payload.from)} → ${prettyPathToKey(payload.to)}`;
	}
}

export function sortActionsByWeight(actions: VaultAction[]): VaultAction[] {
	const pathDepth = (action: VaultAction): number => {
		switch (action.type) {
			case VaultActionType.CreateFolder:
			case VaultActionType.DeleteFolder:
				return action.payload.prettyPath.pathParts.length;
			case VaultActionType.MoveFolder:
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

function prettyPathToKey(prettyPath: CoreSplitPath): string {
	return [...prettyPath.pathParts, prettyPath.basename].join("/");
}
