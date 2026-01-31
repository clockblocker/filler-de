/**
 * Generate command - moves files to sharded paths and sets noteKind: DictEntry.
 *
 * Piped composition pattern:
 * checkEligibility → applyMeta → moveToWorter → dispatch
 */

import { err, ok, type Result, ResultAsync } from "neverthrow";
import type { VaultActionManager } from "../../../../managers/obsidian/vault-action-manager";
import { logger } from "../../../../utils/logger";
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

	// Get current md file path
	const splitPath = await vaultActionManager.mdPwd();
	if (!splitPath) {
		logger.warn("[generateCommand] No md file open");
		return err({ kind: GenerateErrorKind.NotMdFile });
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
	const result = await checkEligibility(ctx)
		.andThen(applyMeta)
		.andThen(moveToWorter)
		.asyncAndThen(
			(c) =>
				new ResultAsync(
					vaultActionManager.dispatch(c.actions).then((r) =>
						r
							.map(() => undefined)
							.mapErr(
								(errs): GenerateError => ({
									kind: GenerateErrorKind.DispatchFailed,
									reason: errs.map((e) => e.error).join(", "),
								}),
							),
					),
				),
		);

	if (result.isErr()) {
		logger.warn("[generateCommand] Failed:", JSON.stringify(result.error));
		return result;
	}

	logger.info("[generateCommand] Success");
	return ok(undefined);
}
