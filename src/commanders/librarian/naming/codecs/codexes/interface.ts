import { CODEX_CORE_NAME } from "../../../types/literals";
import { makeTryParseStringAs } from "../../errors";
import type { NodeNameChain } from "../../types/node-name";
import {
	type JoinedSuffixedBasenameForCodex,
	JoinedSuffixedBasenameForCodexSchema,
} from "../../types/suffixed/joined-suffixed";
import {
	joinSeparatedSuffixedBasename,
	separateJoinedSuffixedBasename,
} from "../../types/transformers";
import { makePathPartsFromNodeNameChain } from "../atomic/path-parts-and-node-name-chain";
import {
	makeNodeNameChainFromSeparatedSuffixedBasename,
	makeSeparatedSuffixedBasenameFromNodeNameChain,
} from "../atomic/separated-canonical-basename-and-node-name-chain";

export const tryParseJoinedSuffixedBasenameForCodex = makeTryParseStringAs(
	JoinedSuffixedBasenameForCodexSchema,
);

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
