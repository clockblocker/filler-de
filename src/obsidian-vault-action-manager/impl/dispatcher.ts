import { err, ok, type Result } from "neverthrow";
import type { VaultAction } from "../types/vault-action";
import { sortActionsByWeight } from "../types/vault-action";
import { collapseActions } from "./collapse";
import type { Executor } from "./executor";

export type DispatchResult = Result<void, DispatchError[]>;

export type DispatchError = {
	action: VaultAction;
	error: string;
};

export class Dispatcher {
	constructor(private readonly executor: Executor) {}

	async dispatch(actions: readonly VaultAction[]): Promise<DispatchResult> {
		if (actions.length === 0) {
			return ok(undefined);
		}

		const collapsed = await collapseActions(actions);
		const sorted = sortActionsByWeight(collapsed);

		const errors: DispatchError[] = [];

		for (const action of sorted) {
			const result = await this.executor.execute(action);
			if (result.isErr()) {
				errors.push({
					action,
					error: result.error,
				});
			}
		}

		if (errors.length > 0) {
			return err(errors);
		}

		return ok(undefined);
	}
}
