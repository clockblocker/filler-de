import type { AnySplitPath } from "@textfresser/vault-action-manager";
import type { CodecRules } from "../rules";
import type { SplitPathInsideLibraryCandidate } from ".";
import { checkIfInsideLibrary } from "./internal/predicate";

export type SplitPathInsideLibraryCodecs = {
	/** Quick predicate (for early returns) */
	checkIfInsideLibrary: (sp: AnySplitPath) => boolean;
	/** Type guard for narrowing */
	isInsideLibrary: (
		sp: AnySplitPath,
	) => sp is SplitPathInsideLibraryCandidate;
};

export function makeSplitPathInsideLibraryCodecs(
	rules: CodecRules,
): SplitPathInsideLibraryCodecs {
	return {
		checkIfInsideLibrary: (sp) => checkIfInsideLibrary(rules, sp),
		isInsideLibrary: (sp): sp is SplitPathInsideLibraryCandidate => {
			return checkIfInsideLibrary(rules, sp);
		},
	};
}
