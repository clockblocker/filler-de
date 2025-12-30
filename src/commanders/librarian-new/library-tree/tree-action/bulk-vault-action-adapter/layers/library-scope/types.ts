import z from "zod";
import type { VaultEvent } from "../../../../../../../obsidian-vault-action-manager";

export const ScopeSchema = z.enum([
	"InsideToOutside",
	"InsideToInside",
	"OutsideToInside",
	"OutsideToOutside",
]);

export const Scope = ScopeSchema.enum;
export type Scope = z.infer<typeof ScopeSchema>;

export type LibraryScopedVaultEvent =
	| {
			scope: typeof Scope.InsideToOutside;
			/**
			 * "from" is relative to libraryRoot
			 */
			event: VaultEvent;
	  }
	| {
			scope: typeof Scope.InsideToInside;
			/**
			 * "splitPath" / "from" / "to" are relative to libraryRoot
			 */
			event: VaultEvent;
	  }
	| {
			scope: typeof Scope.OutsideToInside;
			/**
			 * "to" is relative to libraryRoot
			 */
			event: VaultEvent;
	  }
	| {
			scope: typeof Scope.OutsideToOutside;
			/**
			 * all paths are vault paths
			 */
			event: VaultEvent;
	  };
