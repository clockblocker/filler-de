import { CODEX_CORE_NAME } from "../../types/literals";
import { makePathPartsFromNodeNameChain } from "../codecs/atomic/path-parts-and-node-name-chain";
import {
	makeNodeNameChainFromSeparatedSuffixedBasename,
	makeSeparatedSuffixedBasenameFromNodeNameChain,
} from "../codecs/atomic/separated-canonical-basename-and-node-name-chain";
import type { NodeNameChain } from "../types/node-name";
import type { JoinedSuffixedBasenameForCodex } from "../types/suffixed/joined-suffixed";
import {
	joinSeparatedSuffixedBasename,
	separateJoinedSuffixedBasename,
} from "../types/transformers";

export const buildCanonicalBasenameForCodex = (
	nodeNameChainToParent: NodeNameChain,
) => {
	return joinSeparatedSuffixedBasename(
		makeSeparatedSuffixedBasenameFromNodeNameChain([
			CODEX_CORE_NAME,
			...nodeNameChainToParent,
		]),
	);
};

export const buildCanonicalPathPartsForCodex = (
	canonicalBasename: JoinedSuffixedBasenameForCodex,
) => {
	return makePathPartsFromNodeNameChain(
		makeNodeNameChainFromSeparatedSuffixedBasename(
			separateJoinedSuffixedBasename(canonicalBasename),
		),
	);
};
