/**
 * HealingAuditLog - Records all healing operations for debugging.
 *
 * Maintains a rolling log of healing operations that can be:
 * - Queried for recent operations
 * - Exported for debugging
 * - Used to detect patterns in failures
 *
 * The log is in-memory only (not persisted) to avoid performance impact.
 */

import type { HealingError } from "../errors/healing-error";
import { formatHealingError } from "../errors/healing-error";
import type { TreeAction } from "./library-tree/tree-action/types/tree-action";
import type { HealingAction } from "./library-tree/types/healing-action";

// ─── Types ───

type AuditEntryStatus = "success" | "failed" | "partial";

type AuditEntry = {
	id: string;
	timestamp: number;
	treeAction: TreeAction;
	healingActions: HealingAction[];
	status: AuditEntryStatus;
	errors: HealingError[];
	durationMs: number;
};

type AuditStats = {
	total: number;
	success: number;
	failed: number;
	partial: number;
	avgDurationMs: number;
	errorsByKind: Record<string, number>;
};

// ─── HealingAuditLog ───

const DEFAULT_MAX_ENTRIES = 1000;

export class HealingAuditLog {
	private entries: AuditEntry[] = [];
	private maxEntries: number;
	private idCounter = 0;

	constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
		this.maxEntries = maxEntries;
	}

	/**
	 * Record a healing operation.
	 */
	record(
		treeAction: TreeAction,
		healingActions: HealingAction[],
		errors: HealingError[],
		durationMs: number,
	): string {
		const id = `heal-${++this.idCounter}`;
		const status: AuditEntryStatus =
			errors.length === 0
				? "success"
				: healingActions.length > 0
					? "partial"
					: "failed";

		const entry: AuditEntry = {
			durationMs,
			errors,
			healingActions,
			id,
			status,
			timestamp: Date.now(),
			treeAction,
		};

		this.entries.push(entry);

		// Trim to max size
		if (this.entries.length > this.maxEntries) {
			this.entries = this.entries.slice(-this.maxEntries);
		}

		return id;
	}

	/**
	 * Get recent entries.
	 */
	getRecent(count = 10): AuditEntry[] {
		return this.entries.slice(-count);
	}

	/**
	 * Get entries with errors.
	 */
	getErrors(count = 10): AuditEntry[] {
		return this.entries.filter((e) => e.errors.length > 0).slice(-count);
	}

	/**
	 * Get entries by action type.
	 */
	getByActionType(actionType: TreeAction["actionType"]): AuditEntry[] {
		return this.entries.filter(
			(e) => e.treeAction.actionType === actionType,
		);
	}

	/**
	 * Get audit statistics.
	 */
	getStats(): AuditStats {
		const total = this.entries.length;
		const success = this.entries.filter((e) => e.status === "success").length;
		const failed = this.entries.filter((e) => e.status === "failed").length;
		const partial = this.entries.filter((e) => e.status === "partial").length;

		const totalDuration = this.entries.reduce(
			(sum, e) => sum + e.durationMs,
			0,
		);
		const avgDurationMs = total > 0 ? totalDuration / total : 0;

		const errorsByKind: Record<string, number> = {};
		for (const entry of this.entries) {
			for (const error of entry.errors) {
				errorsByKind[error.kind] = (errorsByKind[error.kind] ?? 0) + 1;
			}
		}

		return {
			avgDurationMs,
			errorsByKind,
			failed,
			partial,
			success,
			total,
		};
	}

	/**
	 * Export log as formatted string for debugging.
	 */
	export(count = 50): string {
		const entries = this.getRecent(count);
		const lines: string[] = [
			`=== Healing Audit Log (${entries.length} entries) ===`,
			`Stats: ${JSON.stringify(this.getStats())}`,
			"",
		];

		for (const entry of entries) {
			lines.push(`[${entry.id}] ${entry.treeAction.actionType} - ${entry.status}`);
			lines.push(`  Time: ${new Date(entry.timestamp).toISOString()}`);
			lines.push(`  Duration: ${entry.durationMs}ms`);
			lines.push(`  Healing actions: ${entry.healingActions.length}`);

			if (entry.errors.length > 0) {
				lines.push(`  Errors:`);
				for (const error of entry.errors) {
					lines.push(`    - ${formatHealingError(error)}`);
				}
			}
			lines.push("");
		}

		return lines.join("\n");
	}

	/**
	 * Clear all entries.
	 */
	clear(): void {
		this.entries = [];
	}
}

// ─── Singleton Instance ───

let globalAuditLog: HealingAuditLog | null = null;

/**
 * Get the global audit log instance.
 * Creates one if it doesn't exist.
 */
export function getHealingAuditLog(): HealingAuditLog {
	if (!globalAuditLog) {
		globalAuditLog = new HealingAuditLog();
	}
	return globalAuditLog;
}

/**
 * Reset the global audit log (for testing).
 */
export function resetHealingAuditLog(): void {
	globalAuditLog = null;
}
