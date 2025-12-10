import type { VaultAction } from "../types/vault-action";
import { sortActionsByWeight } from "../types/vault-action";
import { collapseActions } from "./collapse";
import type { Executor } from "./executor";

export class Dispatcher {
	constructor(private readonly executor: Executor) {}

	async dispatch(actions: readonly VaultAction[]): Promise<void> {
		if (actions.length === 0) return;
		const collapsed = await collapseActions(actions);
		const sorted = sortActionsByWeight(collapsed);
		await this.executor.execute(sorted);
	}
}
