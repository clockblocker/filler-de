import { mergeBlockContentsFromIds } from './merging-note-blocks';
import {
	NoteBlockId,
	NEW_LINE,
	ALL_BLOCK_IDS,
	BlockStructure,
	BLOCK_DELIMETER,
	SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
	ContentFromNoteBlockId,
	BlockRepr,
	FileContent,
	BlockContent,
	noteBlockPropsFromNoteBlockId,
	NOTE_BLOCK_TITLE_CSS_CLASS,
	makeBlockHeaderElementFromNoteBlockId,
} from './types-and-constants';

function getBlockRegex({ blockId }: { blockId: NoteBlockId }): RegExp {
	const cssClass = noteBlockPropsFromNoteBlockId[blockId].cssClassName;

	return new RegExp(
		`(<span\\s+class=["']${NOTE_BLOCK_TITLE_CSS_CLASS}\\s+${cssClass}["']>[^<]+</span>)([\\s\\S]*?)(?=(${BLOCK_DELIMETER}|<|$))`,
		'g'
	);
}

function extractBlockContent({
	content,
	blockId,
}: {
	content: FileContent;
	blockId: NoteBlockId;
}): BlockContent {
	const regex = getBlockRegex({ blockId });
	const match = regex.exec(content);
	return match ? match[2].trim() : '';
}

function BUILD_blockContentFromId_FROM_fileContent(
	fileContent: string
): Record<NoteBlockId, BlockContent> {
	const oldBlockContentRecord: Record<NoteBlockId, BlockContent> = {} as Record<
		NoteBlockId,
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

function getNewSortedListByNoteBlockId<T extends { id: NoteBlockId }>(
	blockIdsAndSomething: T[]
): T[] {
	return [...blockIdsAndSomething].sort((a, b) => {
		const { weight: weightA } = noteBlockPropsFromNoteBlockId[a.id];
		const { weight: weightB } = noteBlockPropsFromNoteBlockId[b.id];

		return weightA - weightB;
	});
}

function BUILD_sortedBlockStructures_FROM_mergedContentFromNoteBlockId(
	mergedContentFromNoteBlockId: Partial<ContentFromNoteBlockId>
): BlockStructure[] {
	const blocksIdsAndStructures: {
		id: NoteBlockId;
		structure: BlockStructure;
	}[] = [];

	ALL_BLOCK_IDS.forEach((id) => {
		const blockContent = mergedContentFromNoteBlockId?.[id];
		if (blockContent === undefined) {
			return;
		}

		const trimmedHeaderElement =
			makeBlockHeaderElementFromNoteBlockId(id).trim();

		const trimmedContent = blockContent.trim();

		const preDelimeterSpacing =
			noteBlockPropsFromNoteBlockId[id].preDelimeterSpacing;

		const structure = {
			headerElement: trimmedHeaderElement,
			content: trimmedContent,
			preDelimeterSpacing,
			delimeter: BLOCK_DELIMETER,
		};

		blocksIdsAndStructures.push({ id, structure });
	});

	return getNewSortedListByNoteBlockId(blocksIdsAndStructures).map(
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
	setOfNoteBlockIdsToCreateIfEmpty = SET_OF_REQUIRED_TECHNIKAL_BLOCK_IDS,
}: {
	oldFileContent: FileContent;
	newBlockContentFromId: Partial<ContentFromNoteBlockId>;
	setOfNoteBlockIdsToCreateIfEmpty?: Set<NoteBlockId>;
}): Promise<FileContent> {
	const oldBlockContentFromId =
		BUILD_blockContentFromId_FROM_fileContent(oldFileContent);

	const blockContentsFromIds = [newBlockContentFromId, oldBlockContentFromId];
	const mergedContentFromNoteBlockId = mergeBlockContentsFromIds({
		blockContentsFromIds,
		setOfNoteBlockIdsToCreateIfEmpty,
	});

	const sortedBlockStructures =
		BUILD_sortedBlockStructures_FROM_mergedContentFromNoteBlockId(
			mergedContentFromNoteBlockId
		);

	const sortedBlockReprs = BUILD_sortedBlockReprs_FROM_sortedBlockStructures(
		sortedBlockStructures
	);

	const fileContent = BUILD_fileContent_FROM_sortedBlockReprs(sortedBlockReprs);
	return fileContent;
}
