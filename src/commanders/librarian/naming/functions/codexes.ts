import { getParsedUserSettings } from "../../../../global-state/global-state";
import { CODEX_CORE_NAME } from "../../types/literals";
import { makePathPartsFromNodeNameChain } from "../codecs/atomic/path-parts-and-node-name-chain";
import {
	makeNodeNameChainFromSeparatedSuffixedBasename,
	makeSeparatedSuffixedBasenameFromNodeNameChain,
} from "../codecs/atomic/separated-canonical-basename-and-node-name-chain";
import type { NodeNameChain } from "../types/node-name";
import type { JoinedSuffixedBasenameForCodex } from "../types/suffixed/joined-suffixed";
import type { SeparatedSuffixedBasename } from "../types/suffixed/separated-suffixed";
import {
	joinSeparatedSuffixedBasename,
	separateJoinedSuffixedBasename,
} from "../types/transformers";

export const makeCanonicalBasenameForCodex = (
	nodeNameChainToParent: NodeNameChain,
) => {
	const {
		splitPathToLibraryRoot: { basename: libraryRoot },
	} = getParsedUserSettings();

	return joinSeparatedSuffixedBasename(
		makeSeparatedSuffixedBasenameFromNodeNameChain([
			...(nodeNameChainToParent.length > 0
				? [...nodeNameChainToParent].reverse()
				: [libraryRoot]),
			CODEX_CORE_NAME,
		]),
	);
};

export const makeNodeNameChainToParentFromCanonicalBasenameForCodex = (
	basename: SeparatedSuffixedBasename,
): NodeNameChain => {
	const {
		splitPathToLibraryRoot: { basename: libraryRoot },
	} = getParsedUserSettings();

	const fullChain = makeNodeNameChainFromSeparatedSuffixedBasename(basename);

	// CODEX_CORE_NAME is at the end, remove it
	const chainWithoutCodex = fullChain.slice(0, -1);

	// If chain was empty originally, it would have been [libraryRoot, CODEX_CORE_NAME]
	// Remove libraryRoot to get empty chain
	if (
		chainWithoutCodex.length === 1 &&
		chainWithoutCodex[0] === libraryRoot
	) {
		return [];
	}

	// Reverse back to original order (was reversed during encoding)
	return chainWithoutCodex.reverse();
};

export const buildCanonicalPathPartsForCodex = (
	canonicalBasename: JoinedSuffixedBasenameForCodex,
) => {
	const separated = separateJoinedSuffixedBasename(canonicalBasename);
	const nodeNameChain =
		makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);
	return makePathPartsFromNodeNameChain(nodeNameChain);
};
