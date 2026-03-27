export {
	parseSeparatedSuffix,
} from "./internal/suffix/parse";
export {
	pathPartsToSuffixParts,
	pathPartsWithRootToSuffixParts,
	suffixPartsToPathParts,
} from "./internal/suffix/path-parts";
export {
	serializeSeparatedSuffix,
	serializeSeparatedSuffixUnchecked,
} from "./internal/suffix/serialize";
export type { SeparatedSuffixedBasename } from "./internal/suffix/types";
