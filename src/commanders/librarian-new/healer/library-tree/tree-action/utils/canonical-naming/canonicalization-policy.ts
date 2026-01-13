// Re-export policy functions from codecs layer
// Policy functions moved to codecs layer to avoid circular dependencies
export {
	buildCanonicalSeparatedSuffixedBasename,
	canonizeSplitPathWithSeparatedSuffix,
	validateCanonicalFormat,
} from "../../../../../codecs/canonical-split-path/internal/canonicalization-policy";
