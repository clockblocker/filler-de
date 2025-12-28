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
		const {
			splitPathToLibraryRoot: { basename: libraryRoot },
		} = getParsedUserSettings();

		const [sectionNodeName, ...splitSuffixOfSection] = splitSuffixOfCodex;

		// This should never happen. Assertion of BasenameForCodex's correctness should be handled by the caller.
		if (!sectionNodeName) {
			throw new Error("Invalid codex basename");
		}

		// If section is library root, return chain with only library root
		if (
			sectionNodeName === libraryRoot &&
			splitSuffixOfSection.length === 0
		) {
			return [libraryRoot];
		}

		// Decode the full chain (includes section name, already includes library root)
		const fullChain = makeNodeNameChainFromSeparatedSuffixedBasename({
			nodeName: sectionNodeName,
			splitSuffix: splitSuffixOfSection,
		});

		// Return full chain (function name is misleading - it returns full chain, not just parent)
		return fullChain;
	};

export const buildCanonicalPathPartsForCodex = (
	canonicalBasename: JoinedSuffixedBasenameForCodex,
) => {
	const separated = separateJoinedSuffixedBasename(canonicalBasename);
	const nodeNameChain =
		makeNodeNameChainToParentFromSeparatedCanonicalBasenameForCodex(
			separated,
		);

	return makePathPartsFromNodeNameChain(nodeNameChain);
};
