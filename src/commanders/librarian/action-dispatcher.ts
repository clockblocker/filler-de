import type { LegacyVaultAction } from "../../services/obsidian-services/file-services/background/background-vault-actions";
import type { VaultActionQueue } from "../../services/obsidian-services/file-services/vault-action-queue";
import type { SelfEventTracker } from "./utils/self-event-tracker";

/**
 * Centralized bridge for queue + self-event tracking.
 * Keeps call sites concise and consistent.
 */
export class ActionDispatcher {
	private readonly queue: VaultActionQueue;
	private readonly tracker: SelfEventTracker;

	constructor(queue: VaultActionQueue, tracker: SelfEventTracker) {
		this.queue = queue;
		this.tracker = tracker;
	}

	registerSelf(actions: LegacyVaultAction[]): void {
		this.tracker.register(actions);
	}

	push(action: LegacyVaultAction): void {
		this.queue.push(action);
	}

	pushMany(actions: LegacyVaultAction[]): void {
		this.queue.pushMany(actions);
	}

	async flushNow(): Promise<void> {
		await this.queue.flushNow();
	}
}
