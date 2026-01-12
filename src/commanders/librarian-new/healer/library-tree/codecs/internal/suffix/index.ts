import type { CodecError } from "../../errors";
import type { CodecRules } from "../../rules";
import type { SeparatedSuffixedBasename } from "./types";
import { parseSeparatedSuffix } from "./parse";
import {
	pathPartsToSuffixParts,
	pathPartsWithRootToSuffixParts,
	suffixPartsToPathParts,
} from "./path-parts";
import {
	serializeSeparatedSuffix,
	serializeSeparatedSuffixUnchecked,
} from "./serialize";
import { splitBySuffixDelimiter } from "./split";
import type { NonEmptyArray } from "../../../../../../types/helpers";
import type { NodeName } from "../../../../../types/schemas/node-name";

export type SuffixCodecs = {
	parseSeparatedSuffix: (
		basename: string,
	) => Result<SeparatedSuffixedBasename, CodecError>;
	serializeSeparatedSuffix: (
		suffix: SeparatedSuffixedBasename,
	) => string;
	serializeSeparatedSuffixUnchecked: (suffix: {
		coreName: string;
		suffixParts: string[];
	}) => Result<string, CodecError>;
	splitBySuffixDelimiter: (
		basename: string,
	) => Result<NonEmptyArray<NodeName>, CodecError>;
	pathPartsWithRootToSuffixParts: (pathParts: string[]) => NodeName[];
	pathPartsToSuffixParts: (pathParts: string[]) => NodeName[];
	suffixPartsToPathParts: (suffixParts: NodeName[]) => string[];
};

export function makeSuffixCodecs(rules: CodecRules): SuffixCodecs {
	return {
		parseSeparatedSuffix: (basename) => parseSeparatedSuffix(rules, basename),
		serializeSeparatedSuffix: (suffix) =>
			serializeSeparatedSuffix(rules, suffix),
		serializeSeparatedSuffixUnchecked: (suffix) =>
			serializeSeparatedSuffixUnchecked(rules, suffix),
		splitBySuffixDelimiter: (basename) =>
			splitBySuffixDelimiter(rules, basename),
		pathPartsWithRootToSuffixParts: (pathParts) =>
			pathPartsWithRootToSuffixParts(rules, pathParts),
		pathPartsToSuffixParts,
		suffixPartsToPathParts,
	};
}
