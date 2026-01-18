import type { Result } from "neverthrow";
import type { SplitPathKind } from "../../../../managers/obsidian/vault-action-manager/types/split-path";
import type { CodecError } from "../errors";
import type { SuffixCodecs } from "../internal/suffix";
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
	suffix: SuffixCodecs,
): SplitPathWithSeparatedSuffixCodecs {
	return {
		fromSplitPathInsideLibraryWithSeparatedSuffix: (sp) =>
			fromSplitPathInsideLibraryWithSeparatedSuffix(suffix, sp),
		splitPathInsideLibraryToWithSeparatedSuffix: (sp) =>
			splitPathInsideLibraryToWithSeparatedSuffix(suffix, sp),
	};
}
