import { makeCanonicalSplitPathCodecs } from "./canonical-split-path";
import type { CanonicalSplitPathCodecs } from "./canonical-split-path";
import type { CodecError } from "./errors";
import { makeLocatorCodecs } from "./locator";
import type { LocatorCodecs } from "./locator";
import { makeSegmentIdCodecs } from "./segment-id";
import type { SegmentIdCodecs } from "./segment-id";
import { makeSplitPathInsideLibraryCodecs } from "./split-path-inside-library";
import type { SplitPathInsideLibraryCodecs } from "./split-path-inside-library";
import { makeSuffixCodecs } from "./internal/suffix";
import type { SuffixCodecs } from "./internal/suffix";
import type { CodecRules } from "./rules";
import { makeCodecRulesFromSettings } from "./rules";

/**
 * Public codec API.
 * All codecs are created in dependency order and dependencies are injected.
 */
export type Codecs = {
	segmentId: SegmentIdCodecs;
	splitPathInsideLibrary: SplitPathInsideLibraryCodecs;
	canonicalSplitPath: CanonicalSplitPathCodecs;
	locator: LocatorCodecs;
};

/**
 * Creates all codecs with rules.
 * Factory creates codecs in dependency order (lowest to highest):
 * 1. suffix (no dependencies, internal)
 * 2. segmentId (no dependencies)
 * 3. splitPathInsideLibrary (minimal dependencies)
 * 4. canonicalSplitPath (depends on suffix)
 * 5. locator (depends on segmentId, canonicalSplitPath, suffix)
 */
export function makeCodecs(rules: CodecRules): Codecs {
	// Create in dependency order (lowest to highest)
	const suffix = makeSuffixCodecs(rules); // Internal - only used for injection
	const segmentId = makeSegmentIdCodecs(rules);
	const splitPathInsideLibrary = makeSplitPathInsideLibraryCodecs(rules);
	const canonicalSplitPath = makeCanonicalSplitPathCodecs(rules, suffix);
	const locator = makeLocatorCodecs(segmentId, canonicalSplitPath, suffix);

	// Return only public codec objects (suffix is internal, not exposed)
	return {
		segmentId,
		splitPathInsideLibrary,
		canonicalSplitPath,
		locator,
	};
}

// Re-export types for convenience
export type { CodecError } from "./errors";
export type { CodecRules } from "./rules";
export { makeCodecRulesFromSettings } from "./rules";

// Re-export public types from modules
export type { SegmentIdComponents } from "./segment-id";
export type {
	SplitPathInsideLibrary,
	SplitPathToFileInsideLibrary,
	SplitPathToFolderInsideLibrary,
	SplitPathToMdFileInsideLibrary,
} from "./split-path-inside-library";
export type {
	CanonicalSplitPathInsideLibrary,
	CanonicalSplitPathToFileInsideLibrary,
	CanonicalSplitPathToFolderInsideLibrary,
	CanonicalSplitPathToMdFileInsideLibrary,
	SeparatedSuffixedBasename,
} from "./canonical-split-path";
export type {
	TreeNodeLocator,
	SectionNodeLocator,
	ScrollNodeLocator,
	FileNodeLocator,
} from "./locator";
