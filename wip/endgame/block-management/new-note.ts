import { mergeBlockContentsFromIds } from './merging-blocks';
import {
	BlockId,
	NEW_LINE,
	ALL_BLOCK_IDS,
	BlockStructure,
	BLOCK_DELIMETER,
	SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	ContentFromBlockId,
	BlockRepr,
	FileContent,
	BlockContent,
} from './types-and-constants';

function getBlockRegex({ blockId }: { blockId: BlockId }): RegExp {
	const cssClass = cssClassNameFromBlockId[blockId];
	return new RegExp(
		`(<span\\s+class=["']block_title\\s+${cssClass}["']>[^<]+</span>)([\\s\\S]*?)(?=(${BLOCK_DELIMETER}|<|$))`,
		'g'
	);
}

function extractBlockContent({
	content,
	blockId,
}: {
	content: FileContent;
	blockId: BlockId;
}): BlockContent {
	const regex = getBlockRegex({ blockId });
	const match = regex.exec(content);
	return match ? match[2].trim() : '';
}

function BUILD_blockContentFromId_FROM_fileContent(
	fileContent: string
): Record<BlockId, BlockContent> {
	const oldBlockContentRecord: Record<BlockId, BlockContent> = {} as Record<
		BlockId,
		BlockContent
	>;

	ALL_BLOCK_IDS.forEach((blockId) => {
		oldBlockContentRecord[blockId] = extractBlockContent({
			content: fileContent,
			blockId,
		});
	});

	return oldBlockContentRecord;
}

function getNewSortedListByBlockId<T extends { id: BlockId }>(
	blockIdsAndSomething: T[]
): T[] {
	return [...blockIdsAndSomething].sort(
		(a, b) => weightFromBlockId[a.id] - weightFromBlockId[b.id]
	);
}

function BUILD_sortedBlockStructures_FROM_mergedContentFromBlockId(
	mergedContentFromBlockId: Partial<ContentFromBlockId>
): BlockStructure[] {
	const blocksIdsAndStructures: { id: BlockId; structure: BlockStructure }[] =
		[];

	ALL_BLOCK_IDS.forEach((id) => {
		const blockContent = mergedContentFromBlockId?.[id];
		if (blockContent === undefined) {
			return;
		}

		const trimmedHeaderElement = blockHeaderElementFromBlockId[id].trim();
		const trimmedContent = blockContent.trim();
		const preDelimeterSpacing = preDelimeterSpacingFromBlockId[id];

		const structure = {
			headerElement: trimmedHeaderElement,
			content: trimmedContent,
			preDelimeterSpacing,
			delimeter: BLOCK_DELIMETER,
		};

		blocksIdsAndStructures.push({ id, structure });
	});

	return getNewSortedListByBlockId(blocksIdsAndStructures).map(
		({ structure }) => structure
	);
}

function BUILD_sortedBlockReprs_FROM_sortedBlockStructures(
	sortedBlockStructures: BlockStructure[]
): BlockRepr[] {
	const blockReprs = sortedBlockStructures.map(
		({ headerElement, content, preDelimeterSpacing, delimeter }) => {
			const spacedOutDelimiter = preDelimeterSpacing + delimeter;
			const nonEmptyParts = [headerElement, content, spacedOutDelimiter].filter(
				(s) => s
			);
			return nonEmptyParts.join(NEW_LINE);
		}
	);

	return blockReprs;
}

function BUILD_fileContent_FROM_sortedBlockReprs(
	sortedBlockReprs: BlockRepr[]
): string {
	return sortedBlockReprs.join(NEW_LINE);
}

export async function makeNewFileContent({
	oldFileContent,
	newBlockContentFromId,
	setOfBlockIdsToCreateIfEmpty = SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
}: {
	oldFileContent: FileContent;
	newBlockContentFromId: Partial<ContentFromBlockId>;
	setOfBlockIdsToCreateIfEmpty?: Set<BlockId>;
}): Promise<FileContent> {
	const oldBlockContentFromId =
		BUILD_blockContentFromId_FROM_fileContent(oldFileContent);

	const blockContentsFromIds = [newBlockContentFromId, oldBlockContentFromId];
	const mergedContentFromBlockId = mergeBlockContentsFromIds({
		blockContentsFromIds,
		setOfBlockIdsToCreateIfEmpty,
	});

	const sortedBlockStructures =
		BUILD_sortedBlockStructures_FROM_mergedContentFromBlockId(
			mergedContentFromBlockId
		);

	const sortedBlockReprs = BUILD_sortedBlockReprs_FROM_sortedBlockStructures(
		sortedBlockStructures
	);

	const fileContent = BUILD_fileContent_FROM_sortedBlockReprs(sortedBlockReprs);
	return fileContent;
}
