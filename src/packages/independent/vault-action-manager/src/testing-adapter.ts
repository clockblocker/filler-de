import type { App } from "obsidian";
import type { DispatchBatchCoordinator } from "./impl/actions-processing/dispatch-batch";
import type { SelfEventTracker } from "./impl/event-processing/self-event-tracker";
import type { VaultObservation } from "./impl/event-processing/vault-observation";
import { logger } from "./internal/logger";
import { sleep } from "./internal/sleep";

/**
 * Readiness adapter for running-Obsidian tests.
 *
 * It observes the same coordinator, observation pipeline, and Self Event
 * tracker used by the production manager; it never constructs a second graph.
 */
export class VaultActionManagerTestingAdapter {
	constructor(
		private readonly app: App,
		private readonly dispatches: DispatchBatchCoordinator,
		private readonly observation: VaultObservation,
		private readonly selfEvents: SelfEventTracker,
	) {}

	async whenSettled(): Promise<void> {
		await this.dispatches.whenIdle();

		// Turn a pending quiet window into observable subscriber work, then wait
		// for any Dispatch Batches caused by those subscribers.
		this.observation.flushPending();
		await this.observation.whenIdle();
		await this.dispatches.whenIdle();

		const filePaths = this.selfEvents.getRegisteredFilePaths();
		await this.selfEvents.waitForAllRegistered();
		await this.verifyFilesQueryable(filePaths);
	}

	private async verifyFilesQueryable(
		filePaths: readonly string[],
	): Promise<void> {
		if (filePaths.length === 0) return;

		const maxTimeoutMs = 10_000;
		const startedAt = Date.now();
		let intervalMs = 50;
		let checkCount = 0;

		await sleep(100);
		while (Date.now() - startedAt < maxTimeoutMs) {
			const missing = filePaths.filter(
				(path) => !this.app.vault.getAbstractFileByPath(path),
			);
			if (missing.length === 0) return;

			checkCount++;
			if (checkCount > 10) {
				intervalMs = Math.min(intervalMs * 1.2, 200);
			}
			await sleep(intervalMs);
		}

		const missing = filePaths.filter(
			(path) => !this.app.vault.getAbstractFileByPath(path),
		);
		if (missing.length > 0) {
			logger.warn(
				`[VaultActionManagerTestingAdapter] Files not queryable after ${maxTimeoutMs}ms:`,
				missing,
			);
		}
	}
}
