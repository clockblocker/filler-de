import { getParsedUserSettings } from "../../../../global-state/global-state";
import { CODEX_CORE_NAME } from "../../types/literals";
import type { NodeNameChain } from "../../types/schemas/node-name";
import type { SectionNode } from "../../types/tree-node";
import { makePathPartsFromNodeNameChain } from "../codecs/atomic/path-parts-and-node-name-chain";
import {
	makeNodeNameChainFromSeparatedSuffixedBasename,
	makeSeparatedSuffixedBasenameFromNodeNameChain,
} from "../codecs/atomic/separated-canonical-basename-and-node-name-chain";
import type { JoinedSuffixedBasenameForCodex } from "../types/suffixed/joined-suffixed";
import type { SeparatedSuffixedBasename } from "../types/suffixed/separated-suffixed";
import {
	joinSeparatedSuffixedBasename,
	separateJoinedSuffixedBasename,
} from "../types/transformers";

export const makeCanonicalBasenameForCodexFromSectionNode = ({
	nodeNameChainToParent,
	nodeName,
}: Pick<SectionNode, "nodeNameChainToParent" | "nodeName">) => {
	const {
		splitPathToLibraryRoot: { basename: libraryRoot },
	} = getParsedUserSettings();

	// Strip library root before encoding (user-visible format should not include it)
	const fullChain = [...nodeNameChainToParent, nodeName];
	const chainWithoutLibraryRoot =
		fullChain.length > 0 && fullChain[0] === libraryRoot
			? fullChain.slice(1)
			: fullChain;

	return makeCanonicalBasenameForCodexFromNodeNameChainToParent(
		chainWithoutLibraryRoot,
	);
};

const makeCanonicalBasenameForCodexFromNodeNameChainToParent = (
	nodeNameChainToParent: NodeNameChain,
) => {
	const {
		splitPathToLibraryRoot: { basename: libraryRoot },
	} = getParsedUserSettings();

	return joinSeparatedSuffixedBasename(
		makeSeparatedSuffixedBasenameFromNodeNameChain([
			...(nodeNameChainToParent.length > 0
				? nodeNameChainToParent
				: [libraryRoot]),
			CODEX_CORE_NAME,
		]),
	);
};

export const makeNodeNameChainToParentFromCanonicalBasenameForCodex = ({
	nodeName: _nodeNameOfCodex,
	splitSuffix: splitSuffixOfCodex,
}: SeparatedSuffixedBasename): NodeNameChain => {
	const {
		splitPathToLibraryRoot: { basename: libraryRoot },
	} = getParsedUserSettings();

	const [sectionNodeName, ...splitSuffixOfSection] = splitSuffixOfCodex;

	// This should never happen. Assertion of BasenameForCodex's correctness should be handled by the caller.
	if (!sectionNodeName) {
		throw new Error("Invalid codex basename");
	}

	// Decode the full chain (includes section name)
	const fullChainWithoutLibraryRoot =
		makeNodeNameChainFromSeparatedSuffixedBasename({
			nodeName: sectionNodeName,
			splitSuffix: splitSuffixOfSection,
		});

	// Extract parent chain (remove section name, which is the last element)
	const parentChainWithoutLibraryRoot = fullChainWithoutLibraryRoot.slice(
		0,
		-1,
	);

	// Add library root back (internal representation includes it)
	if (sectionNodeName === libraryRoot) {
		// Root codex: return chain with only library root
		return [libraryRoot];
	}

	return [libraryRoot, ...parentChainWithoutLibraryRoot];
};

export const buildCanonicalPathPartsForCodex = (
	canonicalBasename: JoinedSuffixedBasenameForCodex,
) => {
	const separated = separateJoinedSuffixedBasename(canonicalBasename);
	const nodeNameChain =
		makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);

	return makePathPartsFromNodeNameChain(nodeNameChain);
};
