import type { SplitPathKind } from "@textfresser/vault-action-manager";
import type { Result } from "neverthrow";
import type { CodecError } from "../errors";
import type { SuffixCodecs } from "../internal/suffix";
import type { CodecRules } from "../rules";
import type { SplitPathInsideLibraryOf } from "../split-path-inside-library";
import { fromSplitPathInsideLibraryWithSeparatedSuffix } from "./internal/from";
import { splitPathInsideLibraryToWithSeparatedSuffix } from "./internal/to";
import type { SplitPathInsideLibraryWithSeparatedSuffixOf } from "./types";

export type SplitPathWithSeparatedSuffixCodecs = {
	splitPathInsideLibraryToWithSeparatedSuffix: <SK extends SplitPathKind>(
		sp: SplitPathInsideLibraryOf<SK>,
	) => Result<SplitPathInsideLibraryWithSeparatedSuffixOf<SK>, CodecError>;
	fromSplitPathInsideLibraryWithSeparatedSuffix: <SK extends SplitPathKind>(
		sp: SplitPathInsideLibraryWithSeparatedSuffixOf<SK>,
	) => SplitPathInsideLibraryOf<SK>;
};

export function makeSplitPathWithSeparatedSuffixCodecs(
	rules: CodecRules,
	suffix: SuffixCodecs,
): SplitPathWithSeparatedSuffixCodecs {
	return {
		fromSplitPathInsideLibraryWithSeparatedSuffix: (sp) =>
			fromSplitPathInsideLibraryWithSeparatedSuffix(suffix, sp),
		splitPathInsideLibraryToWithSeparatedSuffix: (sp) =>
			splitPathInsideLibraryToWithSeparatedSuffix(rules, suffix, sp),
	};
}
