import { err, ok, type Result } from "neverthrow";
import {
	makeSystemPathForSplitPath,
	type VaultAction,
	VaultActionKind,
} from "../../../../../managers/obsidian/vault-action-manager";
import type { SplitPathToMdFile } from "../../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { CommandError } from "../../types";
import type { GenerateSectionsResult } from "./generate-sections";
import { propagateInflections } from "./propagate-inflections";
import { propagateMorphemes } from "./propagate-morphemes";
import { propagateMorphologyRelations } from "./propagate-morphology-relations";
import { propagateRelations } from "./propagate-relations";

type ProcessTransform = (content: string) => string | Promise<string>;

function buildV2Error(reason: string): CommandError {
	return {
		kind: "ApiError",
		reason,
	};
}

function composeTransforms(
	transforms: ReadonlyArray<ProcessTransform>,
): ProcessTransform {
	return async (content: string) => {
		let next = content;
		for (const transform of transforms) {
			next = await transform(next);
		}
		return next;
	};
}

function extractProcessTransform(
	action: Extract<VaultAction, { kind: typeof VaultActionKind.ProcessMdFile }>,
): Result<
	{ splitPath: SplitPathToMdFile; transform: ProcessTransform },
	CommandError
> {
	if (!("transform" in action.payload)) {
		return err(
			buildV2Error(
				"[propagateV2] Unsupported ProcessMdFile payload shape: expected transform",
			),
		);
	}

	return ok({
		splitPath: action.payload.splitPath,
		transform: action.payload.transform,
	});
}

function buildRenameActionKey(
	action: Extract<VaultAction, { kind: typeof VaultActionKind.RenameMdFile }>,
): string {
	const from = makeSystemPathForSplitPath(action.payload.from);
	const to = makeSystemPathForSplitPath(action.payload.to);
	return `${from}=>${to}`;
}

type TargetWritePlan = {
	splitPath: SplitPathToMdFile;
	transforms: ProcessTransform[];
};

export function foldScopedActionsToSingleWritePerTarget(
	actions: ReadonlyArray<VaultAction>,
): Result<VaultAction[], CommandError> {
	const renameActionsByKey = new Map<
		string,
		Extract<VaultAction, { kind: typeof VaultActionKind.RenameMdFile }>
	>();
	const writePlansByPath = new Map<string, TargetWritePlan>();

	for (const action of actions) {
		if (action.kind === VaultActionKind.RenameMdFile) {
			renameActionsByKey.set(buildRenameActionKey(action), action);
			continue;
		}

		if (action.kind === VaultActionKind.UpsertMdFile) {
			const content = action.payload.content;
			if (content !== null && content !== undefined) {
				return err(
					buildV2Error(
						"[propagateV2] Unsupported UpsertMdFile payload: non-null content cannot be folded safely",
					),
				);
			}
			continue;
		}

		if (action.kind === VaultActionKind.ProcessMdFile) {
			const transformResult = extractProcessTransform(action);
			if (transformResult.isErr()) {
				return err(transformResult.error);
			}
			const { splitPath, transform } = transformResult.value;
			const targetPath = makeSystemPathForSplitPath(splitPath);
			const existing = writePlansByPath.get(targetPath);
			if (existing) {
				existing.transforms.push(transform);
			} else {
				writePlansByPath.set(targetPath, {
					splitPath,
					transforms: [transform],
				});
			}
			continue;
		}

		return err(
			buildV2Error(
				`[propagateV2] Unsupported scoped action kind: ${action.kind}`,
			),
		);
	}

	const foldedWriteActions: VaultAction[] = [];
	for (const plan of writePlansByPath.values()) {
		foldedWriteActions.push({
			kind: VaultActionKind.UpsertMdFile,
			payload: { content: null, splitPath: plan.splitPath },
		});
		foldedWriteActions.push({
			kind: VaultActionKind.ProcessMdFile,
			payload: {
				splitPath: plan.splitPath,
				transform: composeTransforms(plan.transforms),
			},
		});
	}

	return ok([...renameActionsByKey.values(), ...foldedWriteActions]);
}

function collectNounScopedActions(
	ctx: GenerateSectionsResult,
): Result<ReadonlyArray<VaultAction>, CommandError> {
	const scopedCtx: GenerateSectionsResult = {
		...ctx,
		actions: [],
	};
	return propagateRelations(scopedCtx)
		.andThen(propagateMorphologyRelations)
		.andThen(propagateMorphemes)
		.andThen(propagateInflections)
		.map((result) => result.actions);
}

export function propagateV2(
	ctx: GenerateSectionsResult,
): Result<GenerateSectionsResult, CommandError> {
	return collectNounScopedActions(ctx)
		.andThen(foldScopedActionsToSingleWritePerTarget)
		.map((foldedActions) => ({
			...ctx,
			actions: [...ctx.actions, ...foldedActions],
		}));
}
