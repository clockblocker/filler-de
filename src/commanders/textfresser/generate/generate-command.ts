/**
 * Generate command - moves files to sharded paths and sets noteKind: DictEntry.
 *
 * Piped composition pattern:
 * checkEligibility → applyMeta → moveToWorter → dispatch
 */

import { err, ok, type Result } from "neverthrow";
import type { VaultActionManager } from "../../../managers/obsidian/vault-action-manager";
import { logger } from "../../../utils/logger";
import { applyMeta } from "./steps/apply-meta";
import { checkEligibility } from "./steps/check-eligibility";
import { moveToWorter } from "./steps/move-to-worter";
import {
	type GenerateContext,
	type GenerateError,
	GenerateErrorKind,
} from "./types";

// ─── Dependencies ───

export type GenerateDeps = {
	vaultActionManager: VaultActionManager;
};

// ─── Dispatch Step ───

async function dispatch(
	ctx: GenerateContext,
): Promise<Result<void, GenerateError>> {
	const result = await ctx.vam.dispatch(ctx.actions);
	if (result.isErr()) {
		return err({
			kind: GenerateErrorKind.DispatchFailed,
			reason: result.error.message,
		});
	}
	return ok(undefined);
}

// ─── Pipeline ───

/**
 * Execute generate command for the currently open file.
 * Returns Result<void, GenerateError> - logs errors for now.
 */
export async function generateCommand(
	_payload: Record<string, never>,
	deps: GenerateDeps,
): Promise<Result<void, GenerateError>> {
	const { vaultActionManager } = deps;

	// Get current file path
	const pwdResult = await vaultActionManager.pwd();
	if (pwdResult.isErr()) {
		const error: GenerateError = { kind: GenerateErrorKind.NotMdFile };
		logger.warn("[generateCommand] No file open:", pwdResult.error);
		return err(error);
	}

	const splitPath = pwdResult.value;
	if (splitPath.kind !== "MdFile") {
		const error: GenerateError = { kind: GenerateErrorKind.NotMdFile };
		logger.warn("[generateCommand] Not a markdown file");
		return err(error);
	}

	// Read content
	const contentResult = await vaultActionManager.readContent(splitPath);
	if (contentResult.isErr()) {
		const error: GenerateError = { kind: GenerateErrorKind.NotMdFile };
		logger.warn("[generateCommand] Cannot read file:", contentResult.error);
		return err(error);
	}

	// Build initial context
	const ctx: GenerateContext = {
		actions: [],
		content: contentResult.value,
		splitPath,
		vam: vaultActionManager,
	};

	// Execute pipeline: checkEligibility → applyMeta → moveToWorter → dispatch
	const eligibilityResult = checkEligibility(ctx);
	if (eligibilityResult.isErr()) {
		logger.warn(
			"[generateCommand] Not eligible:",
			JSON.stringify(eligibilityResult.error),
		);
		return eligibilityResult;
	}

	const metaResult = applyMeta(eligibilityResult.value);
	if (metaResult.isErr()) {
		logger.warn(
			"[generateCommand] Apply meta failed:",
			JSON.stringify(metaResult.error),
		);
		return metaResult;
	}

	const moveResult = moveToWorter(metaResult.value);
	if (moveResult.isErr()) {
		logger.warn(
			"[generateCommand] Move failed:",
			JSON.stringify(moveResult.error),
		);
		return moveResult;
	}

	const dispatchResult = await dispatch(moveResult.value);
	if (dispatchResult.isErr()) {
		logger.warn(
			"[generateCommand] Dispatch failed:",
			JSON.stringify(dispatchResult.error),
		);
		return dispatchResult;
	}

	logger.info("[generateCommand] Success");
	return ok(undefined);
}
