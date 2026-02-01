/**
 * HealingTransaction - Wraps healing operations with verification and audit.
 *
 * Provides a transaction-like layer over healing operations:
 * - Collects all healing actions before dispatch
 * - Logs all operations for audit
 * - Enables verification after dispatch
 * - Supports aggregated error reporting
 *
 * Usage:
 *   const tx = new HealingTransaction(healer);
 *   const result = tx.apply(treeAction);
 *   // ... collect more actions ...
 *   const allActions = tx.getHealingActions();
 *   // dispatch to vault...
 *   tx.commit(); // or tx.rollback() on error
 */

import { err, ok, type Result } from "neverthrow";
import { logger } from "../../../utils/logger";
import {
	aggregateErrors,
	type HealingError,
	makeInternalError,
	makeVaultOperationError,
} from "../errors/healing-error";
import type { Healer, HealerApplyResult } from "./healer";
import { getHealingAuditLog } from "./healing-audit-log";
import type { CodexImpact } from "./library-tree/codex/compute-codex-impact";
import type { TreeAction } from "./library-tree/tree-action/types/tree-action";
import type { HealingAction } from "./library-tree/types/healing-action";

// ─── Types ───

type TransactionState = "pending" | "committed" | "rolledBack";

type TransactionEntry = {
	treeAction: TreeAction;
	result: HealerApplyResult;
	timestamp: number;
};

type TransactionSummary = {
	state: TransactionState;
	entries: number;
	healingActions: number;
	errors: HealingError[];
	duration: number;
	avgDurationPerAction: number;
};

// ─── HealingTransaction ───

export class HealingTransaction {
	private healer: Healer;
	private entries: TransactionEntry[] = [];
	private errors: HealingError[] = [];
	private state: TransactionState = "pending";
	private startTime: number;

	constructor(healer: Healer) {
		this.healer = healer;
		this.startTime = Date.now();
	}

	/**
	 * Apply a tree action and collect healing actions.
	 * Returns the HealerApplyResult from healer.
	 */
	apply(action: TreeAction): Result<HealerApplyResult, HealingError> {
		if (this.state !== "pending") {
			return err(
				makeInternalError(
					`Cannot apply action to ${this.state} transaction`,
				),
			);
		}

		try {
			const result = this.healer.getHealingActionsFor(action);
			this.entries.push({
				result,
				timestamp: Date.now(),
				treeAction: action,
			});
			return ok(result);
		} catch (error) {
			const healingError = makeInternalError(
				"Healer threw exception",
				error instanceof Error ? error : undefined,
			);
			this.errors.push(healingError);
			return err(healingError);
		}
	}

	/**
	 * Get all healing actions collected so far.
	 */
	getHealingActions(): HealingAction[] {
		return this.entries.flatMap((e) => e.result.healingActions);
	}

	/**
	 * Get all codex impacts collected so far.
	 */
	getCodexImpacts(): CodexImpact[] {
		return this.entries.map((e) => e.result.codexImpact);
	}

	/**
	 * Record an error that occurred during dispatch.
	 */
	recordError(error: HealingError): void {
		this.errors.push(error);
	}

	/**
	 * Record a vault operation failure.
	 */
	recordVaultFailure(
		action: HealingAction,
		errorMessage: string,
		recoverable = false,
	): void {
		this.errors.push(
			makeVaultOperationError(action, errorMessage, recoverable),
		);
	}

	/**
	 * Mark transaction as committed (successful).
	 * Records all entries to the audit log.
	 */
	commit(): TransactionSummary {
		this.state = "committed";

		// Record each entry to the audit log
		const auditLog = getHealingAuditLog();
		for (const entry of this.entries) {
			const entryDuration = entry.timestamp - this.startTime;
			auditLog.record(
				entry.treeAction,
				entry.result.healingActions,
				[], // errors collected at transaction level, not per-entry
				entryDuration,
			);
		}

		return this.getSummary();
	}

	/**
	 * Mark transaction as rolled back (failed).
	 */
	rollback(): TransactionSummary {
		this.state = "rolledBack";
		return this.getSummary();
	}

	/**
	 * Check if transaction has errors.
	 */
	hasErrors(): boolean {
		return this.errors.length > 0;
	}

	/**
	 * Get transaction summary for logging.
	 */
	getSummary(): TransactionSummary {
		const duration = Date.now() - this.startTime;
		const avgDurationPerAction =
			this.entries.length > 0 ? duration / this.entries.length : 0;

		return {
			avgDurationPerAction,
			duration,
			entries: this.entries.length,
			errors: this.errors,
			healingActions: this.getHealingActions().length,
			state: this.state,
		};
	}

	/**
	 * Log transaction summary.
	 */
	logSummary(level: "debug" | "info" | "warn" | "error" = "debug"): void {
		const summary = this.getSummary();
		// Workaround: bun-types may not properly type Number.prototype.toFixed
		const avgMs = Math.round(summary.avgDurationPerAction * 10) / 10;
		const msg = `[HealingTx] ${summary.state}: ${summary.entries} actions, ${summary.healingActions} healing, ${summary.errors.length} errors, ${summary.duration}ms (avg ${avgMs}ms/action)`;

		if (summary.errors.length > 0) {
			logger[level](msg, aggregateErrors(summary.errors));
		} else {
			logger[level](msg);
		}
	}
}

