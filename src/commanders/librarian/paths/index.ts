// ─── Namespace Export ───

import {
	assertSectionSegmentId,
	buildCanonicalLeafSplitPath,
	buildCodexBasename,
	buildCodexSplitPath,
	buildObservedLeafSplitPath,
	buildSectionCanonicalPath,
	computeCodexSuffix,
	locatorToSectionSegmentId,
	narrowChildSegmentId,
	parseChainToNodeNames,
	parseSectionChainToNodeNames,
	pathPartsToSuffixParts,
	pathPartsWithRootToSuffixParts,
	sectionChainToPathParts,
	splitPathsEqual,
	suffixPartsToPathParts,
	validateSectionChain,
	validateSectionSegmentId,
} from "./path-finder";

// Re-export individual functions for direct imports
export {
	assertSectionSegmentId,
	buildCanonicalLeafSplitPath,
	buildCodexBasename,
	buildCodexSplitPath,
	buildObservedLeafSplitPath,
	buildSectionCanonicalPath,
	computeCodexSuffix,
	locatorToSectionSegmentId,
	narrowChildSegmentId,
	parseChainToNodeNames,
	parseSectionChainToNodeNames,
	pathPartsToSuffixParts,
	pathPartsWithRootToSuffixParts,
	sectionChainToPathParts,
	splitPathsEqual,
	suffixPartsToPathParts,
	validateSectionChain,
	validateSectionSegmentId,
} from "./path-finder";

export const PathFinder = {
	// Validation
	assertSectionSegmentId,

	// Path building
	buildCanonicalLeafSplitPath,
	buildCodexBasename,
	buildCodexSplitPath,
	buildObservedLeafSplitPath,
	buildSectionCanonicalPath,

	// Suffix computation
	computeCodexSuffix,
	locatorToSectionSegmentId,
	narrowChildSegmentId,

	// Parsing
	parseChainToNodeNames,
	parseSectionChainToNodeNames,
	pathPartsToSuffixParts,
	pathPartsWithRootToSuffixParts,
	sectionChainToPathParts,

	// Comparison
	splitPathsEqual,
	suffixPartsToPathParts,
	validateSectionChain,
	validateSectionSegmentId,
};
