import { makeSuffixCodecs, type SuffixCodecs } from "./internal/suffix";
import type { LibraryPathCodecs } from "./library-path";
import { makeLibraryPathCodecs } from "./library-path";
import type { LocatorCodecs } from "./locator";
import { makeLocatorCodecs } from "./locator";
import type { CodecRules } from "./rules";
import type { SegmentIdCodecs } from "./segment-id";
import { makeSegmentIdCodecs } from "./segment-id";
import type { SplitPathInsideLibraryCodecs } from "./split-path-inside-library";
import { makeSplitPathInsideLibraryCodecs } from "./split-path-inside-library";
import type { SplitPathWithSeparatedSuffixCodecs } from "./split-path-with-separated-suffix";
import { makeSplitPathWithSeparatedSuffixCodecs } from "./split-path-with-separated-suffix";

/**
 * Public codec API.
 * All codecs are created in dependency order and dependencies are injected.
 */
export type Codecs = {
	libraryPath: LibraryPathCodecs;
	locator: LocatorCodecs;
	segmentId: SegmentIdCodecs;
	splitPathInsideLibrary: SplitPathInsideLibraryCodecs;
	splitPathWithSeparatedSuffix: SplitPathWithSeparatedSuffixCodecs;
	suffix: SuffixCodecs;
};

/**
 * Creates all codecs with rules.
 * Factory creates codecs in dependency order (lowest to highest):
 * 1. suffix (no dependencies, internal)
 * 2. segmentId (no dependencies)
 * 3. splitPathInsideLibrary (minimal dependencies)
 * 4. splitPathWithSeparatedSuffix (depends on suffix)
 * 5. libraryPath (depends on segmentId)
 * 6. locator (depends on segmentId, suffix)
 */
export function makeCodecs(rules: CodecRules): Codecs {
	// Create in dependency order (lowest to highest)
	const suffix = makeSuffixCodecs(rules); // Internal - only used for injection
	const segmentId = makeSegmentIdCodecs(rules);
	const splitPathInsideLibrary = makeSplitPathInsideLibraryCodecs(rules);
	const splitPathWithSeparatedSuffix =
		makeSplitPathWithSeparatedSuffixCodecs(suffix);
	const libraryPath = makeLibraryPathCodecs(segmentId);
	const locator = makeLocatorCodecs(segmentId, suffix);

	// Return public codec objects
	return {
		libraryPath,
		locator,
		segmentId,
		splitPathInsideLibrary,
		splitPathWithSeparatedSuffix,
		suffix,
	};
}

// Re-export types for convenience
export type { CodecError } from "./errors";
export type { SeparatedSuffixedBasename } from "./internal/suffix/types";
export type { LibraryPath } from "./library-path";
export type {
	FileNodeLocator,
	ScrollNodeLocator,
	SectionNodeLocator,
	TreeNodeLocator,
} from "./locator";
export type { CodecRules } from "./rules";
export { makeCodecRulesFromSettings } from "./rules";
// Re-export public types from modules
export type { SegmentIdComponents } from "./segment-id";
export type {
	AnySplitPathInsideLibrary,
	SplitPathInsideLibraryOf,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "./split-path-inside-library";
export type {
	AnyCanonicalSplitPathInsideLibrary,
	CanonicalSplitPathInsideLibrary,
	CanonicalSplitPathInsideLibraryOf,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
	SplitPathInsideLibraryWithSeparatedSuffixOf,
} from "./split-path-with-separated-suffix";
