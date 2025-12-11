import type { ObsidianVaultActionManager } from "../../obsidian-vault-action-manager";
import type { VaultAction } from "../../obsidian-vault-action-manager/types/vault-action";
import type { LegacySelfEventTracker } from "./utils/self-event-tracker";

/**
 * Centralized bridge for queue + self-event tracking.
 * Keeps call sites concise and consistent.
 */
export class LegacyActionDispatcher {
	private readonly manager: ObsidianVaultActionManager;
	private readonly buffer: VaultAction[] = [];
	private readonly tracker?: LegacySelfEventTracker;

	constructor(
		manager: ObsidianVaultActionManager,
		tracker?: LegacySelfEventTracker,
	) {
		this.manager = manager;
		this.tracker = tracker;
	}

	registerSelf(actions: VaultAction[]): void {
		this.tracker?.register(actions);
	}

	push(action: VaultAction): void {
		this.buffer.push(action);
	}

	pushMany(actions: VaultAction[]): void {
		this.buffer.push(...actions);
	}

	async flushNow(): Promise<void> {
		if (this.buffer.length === 0) return;
		const actions = [...this.buffer];
		this.buffer.length = 0;
		await this.manager.dispatch(actions);
	}
}
