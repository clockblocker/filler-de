import { CODEX_CORE_NAME } from "../../../types/literals";
import { makeTryParseStringAs } from "../../errors";
import type { NodeNameChain } from "../../types/node-name";
import { JoinedSuffixedBasenameForCodexSchema } from "../../types/suffixed/joined-suffixed";
import { joinSeparatedSuffixedBasename } from "../../types/transformers";
import { makeSeparatedSuffixedBasenameFromNodeNameChain } from "../atomic/separated-canonical-basename-and-node-name-chain";

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
