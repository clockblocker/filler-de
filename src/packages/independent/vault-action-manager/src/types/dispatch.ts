import type { Result } from "neverthrow";
import type { VaultAction } from "./vault-action";

/** Compatibility result retained until external VAM callers migrate to Effect. */
export type DispatchResult = Result<void, DispatchError[]>;

export type DispatchError = {
	readonly action: VaultAction;
	readonly error: string;
};
