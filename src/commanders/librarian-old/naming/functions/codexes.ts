import { getParsedUserSettings } from "../../../../global-state/global-state";
import type { NodeNameChain } from "../../../librarin-shared/types/node-name";
import { CODEX_CORE_NAME } from "../../types/literals";
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
	const fullChain = [...nodeNameChainToParent, nodeName];
	return makeCanonicalBasenameForCodexFromNodeNameChainToParent(fullChain);
};

const makeCanonicalBasenameForCodexFromNodeNameChainToParent = (
	nodeNameChainToParent: NodeNameChain,
) => {
	return joinSeparatedSuffixedBasename(
		makeSeparatedSuffixedBasenameFromNodeNameChain([
			...nodeNameChainToParent,
			CODEX_CORE_NAME,
		]),
	);
};

export const makeNodeNameChainToParentFromCanonicalBasenameForCodex = (
	codexBasename: JoinedSuffixedBasenameForCodex,
): NodeNameChain => {
	const separated = separateJoinedSuffixedBasename(codexBasename);
	return makeNodeNameChainToParentFromSeparatedCanonicalBasenameForCodex(
		separated,
	);
};

export const makeNodeNameChainToParentFromSeparatedCanonicalBasenameForCodex =
	({
		nodeName: _nodeNameOfCodex,
		splitSuffix: splitSuffixOfCodex,
	}: SeparatedSuffixedBasename): NodeNameChain => {
		const [sectionNodeName, ...splitSuffixOfSection] = splitSuffixOfCodex;

		if (!sectionNodeName) {
			throw new Error("Invalid codex basename");
		}

		// Use atomic codec to decode full chain, then extract parent chain
		const fullChain = makeNodeNameChainFromSeparatedSuffixedBasename({
			nodeName: sectionNodeName,
			splitSuffix: splitSuffixOfSection,
		});

		// Parent chain is full chain without the section name (last element)
		return fullChain.slice(0, -1);
	};

export const buildCanonicalPathPartsForCodex = (
	canonicalBasename: JoinedSuffixedBasenameForCodex,
) => {
	const {
		splitPathToLibraryRoot: { basename: libraryRoot },
	} = getParsedUserSettings();

	const separated = separateJoinedSuffixedBasename(canonicalBasename);
	const [sectionNodeName, ...splitSuffixOfSection] = separated.splitSuffix;

	if (!sectionNodeName) {
		throw new Error("Invalid codex basename");
	}

	// Use atomic codec to get full chain directly
	const fullChain = makeNodeNameChainFromSeparatedSuffixedBasename({
		nodeName: sectionNodeName,
		splitSuffix: splitSuffixOfSection,
	});

	// Root codex special case: if section is library root, path parts is just [libraryRoot]
	if (
		fullChain.length === 2 &&
		fullChain[0] === libraryRoot &&
		fullChain[1] === libraryRoot
	) {
		return [libraryRoot];
	}

	// Use atomic codec to convert chain to path parts
	return makePathPartsFromNodeNameChain(fullChain);
};
