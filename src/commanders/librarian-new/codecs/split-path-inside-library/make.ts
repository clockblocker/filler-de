import type { Result } from "neverthrow";
import type { AnySplitPath } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { CodecError } from "../errors";
import type { CodecRules } from "../rules";
import type {
	SplitPathInsideLibrary,
	SplitPathInsideLibraryCandidate,
} from ".";
import { fromInsideLibrary } from "./internal/from";
import { checkIfInsideLibrary } from "./internal/predicate";
import { toInsideLibrary } from "./internal/to";

export type SplitPathInsideLibraryCodecs = {
	/** Quick predicate (for early returns) */
	checkIfInsideLibrary: (sp: AnySplitPath) => boolean;
	/** Type guard for narrowing */
	isInsideLibrary: (
		sp: AnySplitPath,
	) => sp is SplitPathInsideLibraryCandidate;
	/** Canonical API: returns proper CodecError with reason */
	toInsideLibrary: (
		sp: AnySplitPath,
	) => Result<SplitPathInsideLibrary, CodecError>;
	/** Adds LibraryRoot path parts back */
	fromInsideLibrary: (sp: SplitPathInsideLibrary) => AnySplitPath;
};

export function makeSplitPathInsideLibraryCodecs(
	rules: CodecRules,
): SplitPathInsideLibraryCodecs {
	return {
		checkIfInsideLibrary: (sp) => checkIfInsideLibrary(rules, sp),
		fromInsideLibrary: (sp) => fromInsideLibrary(rules, sp),
		isInsideLibrary: (sp): sp is SplitPathInsideLibraryCandidate => {
			return checkIfInsideLibrary(rules, sp);
		},
		toInsideLibrary: (sp) => toInsideLibrary(rules, sp),
	};
}
