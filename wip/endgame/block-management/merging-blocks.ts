import {
	ContentFromBlockId,
	BlockId,
	BlockContent,
	ALL_BLOCK_IDS,
	NEW_LINE,
	VERTIKAL_STICK,
	COMMA,
	LINE_BREAK,
	SPACE,
	HASHTAG,
} from './types-and-constants';

export function mergeBlockContentsFromIds({
	blockContentsFromIds,
	setOfBlockIdsToCreateIfEmpty,
}: {
	blockContentsFromIds: Partial<ContentFromBlockId>[];
	setOfBlockIdsToCreateIfEmpty: Set<BlockId>;
}): ContentFromBlockId {
	const mergedBlockContentFromBlockId: ContentFromBlockId =
		{} as ContentFromBlockId;

	ALL_BLOCK_IDS.forEach((blockId) => {
		const mergedContent = mergerFromBlockId[blockId](
			blockContentsFromIds.map(
				(blockContentFromId) => blockContentFromId[blockId] || ''
			)
		);

		if (mergedContent || setOfBlockIdsToCreateIfEmpty.has(blockId)) {
			mergedBlockContentFromBlockId[blockId] = mergedContent;
		}
	});

	return mergedBlockContentFromBlockId;
}

type BlocksMerger = (contents: BlockContent[]) => BlockContent;

const leaveOnlyOneLeadingSymbol = (line: string) => {
	const leadingSymbols = ['=', '≈', '≠'];
	for (const s of leadingSymbols) {
		if (line.includes(s)) {
			return s + line.replaceAll(s, '');
		}
	}
	return line;
};

const trimmedAndFiltered = (contents: BlockContent[]): BlockContent[] => {
	return contents.map((c) => c.trim()).filter((c) => c);
};

export const joinLinesWithVertikalStick: BlocksMerger = (contents) => {
	const linesInContents = trimmedAndFiltered(contents).map((c) =>
		c.split(LINE_BREAK)
	);

	const theMostLines = Math.max(...linesInContents.map((ls) => ls.length));
	const lines: string[] = [];

	for (let i = 0; i < theMostLines; i++) {
		const lineParts: string[] = [];

		linesInContents.forEach((lines) => {
			if (i < lines.length) {
				lineParts.push(lines[i]);
			} else {
				lineParts.push('');
			}
		});

		lines.push(
			lineParts
				.filter((l) => l)
				.map((l) => leaveOnlyOneLeadingSymbol(l))
				.join(VERTIKAL_STICK)
		);
	}
	return lines.join(LINE_BREAK);
};

export const joinNonEmptyWithNewLine: BlocksMerger = (contents) => {
	return trimmedAndFiltered(contents).join(NEW_LINE);
};

export const mergeWords: BlocksMerger = (contents) => {
	const words: string[] = [];

	trimmedAndFiltered(contents).forEach((c) =>
		trimmedAndFiltered(c.split(COMMA)).forEach((word) => words.push(word))
	);

	return words.join(COMMA + SPACE);
};

export const mergeTags: BlocksMerger = (contents) => {
	const tags: string[] = [];

	trimmedAndFiltered(contents).forEach((c) =>
		trimmedAndFiltered(c.split(HASHTAG)).forEach((tag) => tags.push(tag))
	);

	return tags.map((tag) => HASHTAG + tag).join(SPACE);
};

export const lastReplaces: BlocksMerger = (contents) => {
	const trimmedAndFilteredContents = trimmedAndFiltered(contents);
	const lastIndex = trimmedAndFilteredContents.length - 1;

	if (lastIndex < 0) {
		return '';
	}

	return trimmedAndFilteredContents[lastIndex];
};

const mergerFromBlockId: Record<BlockId, BlocksMerger> = {
	[BlockId.Formen]: joinNonEmptyWithNewLine,
	[BlockId.Kontexte]: joinNonEmptyWithNewLine,
	[BlockId.Synonyme]: joinLinesWithVertikalStick,
	[BlockId.Morpheme]: lastReplaces,
	[BlockId.Translations]: joinLinesWithVertikalStick,
	[BlockId.Related]: mergeWords,
	[BlockId.Flexion]: joinNonEmptyWithNewLine,
	[BlockId.Grammatik]: joinNonEmptyWithNewLine,
	[BlockId.Tags]: mergeTags,
};
