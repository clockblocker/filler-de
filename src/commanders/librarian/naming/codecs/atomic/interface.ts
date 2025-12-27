import { makeTryParseStringAs } from "../../errors";
import type { NodeNameChain } from "../../types/node-name";
import {
	type JoinedSuffixedBasename,
	JoinedSuffixedBasenameForFileSchema,
	JoinedSuffixedBasenameForFolderSchema,
} from "../../types/suffixed/joined-suffixed";
import { makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename } from "./joined-canonical-basename-and-separated-canonical-basename";
import { makeSeparatedSuffixedBasenameFromNodeNameChain } from "./separated-canonical-basename-and-node-name-chain";

export const tryParseJoinedSuffixedBasenameForFile = makeTryParseStringAs(
	JoinedSuffixedBasenameForFileSchema,
);

export const tryParseJoinedSuffixedBasenameForFolder = makeTryParseStringAs(
	JoinedSuffixedBasenameForFolderSchema,
);

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

function makeJoinedSuffixedBasenameFromNodeNameChain(
	chain: NodeNameChain,
): JoinedSuffixedBasename {
	return makeJoinedSuffixedBasenameFromSeparatedSuffixedBasename(
		makeSeparatedSuffixedBasenameFromNodeNameChain(chain),
	);
}
