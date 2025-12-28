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
	return makeCanonicalBasenameForCodexFromNodeNameChainToParent([
		...nodeNameChainToParent,
		nodeName,
	]);
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

	if (sectionNodeName === libraryRoot) {
		return [];
	}

	return makeNodeNameChainFromSeparatedSuffixedBasename({
		nodeName: sectionNodeName,
		splitSuffix: splitSuffixOfSection,
	});
};

export const buildCanonicalPathPartsForCodex = (
	canonicalBasename: JoinedSuffixedBasenameForCodex,
) => {
	const separated = separateJoinedSuffixedBasename(canonicalBasename);
	const nodeNameChain =
		makeNodeNameChainToParentFromCanonicalBasenameForCodex(separated);

	return makePathPartsFromNodeNameChain(nodeNameChain);
};
