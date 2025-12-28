import type { NodeNameChain } from "../../types/schemas/node-name";
import { makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename } from "../codecs/atomic/joined-canonical-basename-and-separated-canonical-basename";
import {
	tryParseJoinedSuffixedBasenameForFile,
	tryParseJoinedSuffixedBasenameForFolder,
} from "../codecs/atomic/parsers";
import { makeSeparatedSuffixedBasenameFromNodeNameChain } from "../codecs/atomic/separated-canonical-basename-and-node-name-chain";
import type { JoinedSuffixedBasename } from "../types/suffixed/joined-suffixed";

export const tryMakeJoinedSuffixedBasenameForFileFromNodeNameChain = (
	chain: NodeNameChain,
) =>
	tryParseJoinedSuffixedBasenameForFile(
		makeJoinedSuffixedBasenameFromNodeNameChain(chain),
	);

export const tryMakeJoinedSuffixedBasenameForFolderFromNodeNameChain = (
	chain: NodeNameChain,
) =>
	tryParseJoinedSuffixedBasenameForFolder(
		makeJoinedSuffixedBasenameFromNodeNameChain(chain),
	);

export function makeJoinedSuffixedBasenameFromNodeNameChain(
	chain: NodeNameChain,
): JoinedSuffixedBasename {
	return makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename(
		makeSeparatedSuffixedBasenameFromNodeNameChain(chain),
	);
}
