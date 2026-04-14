import { parseKnownJsonBlock, makeTextBlock } from "../blocks/block-codecs";
import {
	getMarkerId,
	isBlankLine,
	makeIssue,
	splitLines,
} from "../internal/utils";
import {
	JSON_BLOCK_IDS,
	KNOWN_BLOCK_IDS,
} from "../internal/constants";
import type { EntryBlock } from "../model/blocks";
import type { CodecIssue } from "../model/issues";
import { LinguisticNoteCodecError } from "../model/issues";
import type { EntryDocument, NoteDocument } from "../model/note";
import type { ParseOptions } from "../model/options";
import { CLOSE_RE } from "../internal/constants";

export function parseDocumentStrict(
	markdown: string,
	_options?: ParseOptions,
): NoteDocument {
	const result = parseDocumentInternal(markdown, true);
	if (result.issues.length > 0) {
		throw new LinguisticNoteCodecError(
			result.issues[0]?.message ?? "Failed to parse note document",
			result.issues,
		);
	}
	return result.document;
}

export function parseDocumentLoose(
	markdown: string,
	_options?: ParseOptions,
): {
	document: NoteDocument;
	issues: CodecIssue[];
} {
	return parseDocumentInternal(markdown, false);
}

function parseDocumentInternal(
	markdown: string,
	strict: boolean,
): { document: NoteDocument; issues: CodecIssue[] } {
	const lines = splitLines(markdown);
	const issues: CodecIssue[] = [];
	const entries: EntryDocument[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index];
		if (line === undefined) {
			break;
		}

		if (isBlankLine(line)) {
			index += 1;
			continue;
		}

		if (getMarkerId(line) === "entry") {
			const parsed = parseEntry(lines, index, entries.length, strict);
			if (parsed.issues.length > 0) {
				issues.push(...parsed.issues);
				if (strict) {
					break;
				}
			}
			if (parsed.entry) {
				entries.push(parsed.entry);
			}
			index = parsed.nextIndex;
			continue;
		}

		const start = index;
		while (
			index < lines.length &&
			!isBlankLine(lines[index] ?? "") &&
			getMarkerId(lines[index] ?? "") !== "entry"
		) {
			index += 1;
		}
		const topLevelMarkdown = lines.slice(start, index).join("");
		const issue = makeIssue(
			"UnsupportedTopLevelContent",
			"Top-level markdown outside entry boundaries is unsupported",
			{
				detail: topLevelMarkdown,
			},
		);
		if (strict) {
			throw new LinguisticNoteCodecError(issue.message, [issue]);
		}
		issues.push(issue);
	}

	return {
		document: {
			entries,
		},
		issues,
	};
}

function parseEntry(
	lines: string[],
	startIndex: number,
	entryIndex: number,
	strict: boolean,
): {
	entry?: EntryDocument;
	issues: CodecIssue[];
	nextIndex: number;
} {
	const issues: CodecIssue[] = [];
	const blocks: EntryBlock[] = [];
	let index = startIndex + 1;
	let freeformStart = index;

	while (index < lines.length) {
		const line = lines[index] ?? "";

		if (CLOSE_RE.test(line)) {
			pushFreeformBlock(blocks, lines, freeformStart, index);
			const entry = {
				blocks,
				sourceMarkdown: lines.slice(startIndex, index + 1).join(""),
			} satisfies EntryDocument;
			return { entry, issues, nextIndex: index + 1 };
		}

		const markerId = getMarkerId(line);
		if (markerId === "entry") {
			const issue = makeIssue(
				"InvalidMarkdown",
				"Nested entry markers are not allowed",
				{ entryIndex },
			);
			if (strict) {
				throw new LinguisticNoteCodecError(issue.message, [issue]);
			}
			issues.push(issue);
			index += 1;
			continue;
		}

		if (markerId !== null) {
			pushFreeformBlock(blocks, lines, freeformStart, index);
			const parsedBlock = parseStructuredBlock(
				lines,
				index,
				entryIndex,
				strict,
			);
			issues.push(...parsedBlock.issues);
			if (strict && parsedBlock.issues.length > 0) {
				throw new LinguisticNoteCodecError(
					parsedBlock.issues[0]?.message ?? "Failed to parse block",
					parsedBlock.issues,
				);
			}
			if (parsedBlock.block) {
				blocks.push(parsedBlock.block);
			}
			index = parsedBlock.nextIndex;
			freeformStart = index;
			continue;
		}

		index += 1;
	}

	const issue = makeIssue(
		"InvalidMarkdown",
		"Entry is missing a closing ::: marker",
		{ entryIndex },
	);
	if (strict) {
		throw new LinguisticNoteCodecError(issue.message, [issue]);
	}
	issues.push(issue);
	pushFreeformBlock(blocks, lines, freeformStart, lines.length);
	return {
		entry: {
			blocks,
			sourceMarkdown: lines.slice(startIndex).join(""),
		},
		issues,
		nextIndex: lines.length,
	};
}

function parseStructuredBlock(
	lines: string[],
	startIndex: number,
	entryIndex: number,
	strict: boolean,
): {
	block?: EntryBlock;
	issues: CodecIssue[];
	nextIndex: number;
} {
	const issues: CodecIssue[] = [];
	const opener = lines[startIndex] ?? "";
	const blockId = getMarkerId(opener);
	if (blockId === null || blockId === "entry") {
		return { issues, nextIndex: startIndex + 1 };
	}

	let index = startIndex + 1;
	while (index < lines.length && !CLOSE_RE.test(lines[index] ?? "")) {
		index += 1;
	}

	if (index >= lines.length) {
		const issue = makeIssue(
			"InvalidMarkdown",
			`Block "${blockId}" is missing a closing ::: marker`,
			{ blockId, entryIndex },
		);
		if (strict) {
			return { issues: [issue], nextIndex: lines.length };
		}
		return {
			block: {
				block: "structured_raw",
				blockId,
				markdown: lines.slice(startIndex + 1).join(""),
				reason: "invalid_payload",
				sourceMarkdown: lines.slice(startIndex).join(""),
			},
			issues: [issue],
			nextIndex: lines.length,
		};
	}

	const rawContent = lines.slice(startIndex + 1, index).join("");
	const rawMarkdown = lines.slice(startIndex, index + 1).join("");

	if (!KNOWN_BLOCK_IDS.has(blockId)) {
		issues.push(
			makeIssue(
				"UnknownTypedBlock",
				`Unsupported typed block "${blockId}"`,
				{
					blockId,
					entryIndex,
				},
			),
		);
		return {
			block: {
				block: "structured_raw",
				blockId,
				markdown: rawContent,
				reason: "unknown",
				sourceMarkdown: rawMarkdown,
			},
			issues,
			nextIndex: index + 1,
		};
	}

	if (blockId === "inflexion") {
		issues.push(
			makeIssue(
				"UnknownTypedBlock",
				'Unsupported typed block "inflexion"; use "inflection"',
				{
					blockId,
					entryIndex,
				},
			),
		);
		return {
			block: {
				block: "structured_raw",
				blockId,
				markdown: rawContent,
				reason: "unknown",
				sourceMarkdown: rawMarkdown,
			},
			issues,
			nextIndex: index + 1,
		};
	}

	if (!JSON_BLOCK_IDS.has(blockId)) {
		return {
			block: makeTextBlock(blockId, rawContent, rawMarkdown),
			issues,
			nextIndex: index + 1,
		};
	}

	let parsedJson: unknown;
	try {
		parsedJson = JSON.parse(rawContent);
	} catch (error) {
		const issue = makeIssue(
			"InvalidBlockPayload",
			`Block "${blockId}" must contain valid JSON`,
			{
				blockId,
				detail: error instanceof Error ? error.message : error,
				entryIndex,
			},
		);
		if (strict) {
			return { issues: [issue], nextIndex: index + 1 };
		}
		return {
			block: {
				block: "structured_raw",
				blockId,
				markdown: rawContent,
				reason: "invalid_payload",
				sourceMarkdown: rawMarkdown,
			},
			issues: [issue],
			nextIndex: index + 1,
		};
	}

	const typedBlock = parseKnownJsonBlock(blockId, parsedJson, rawMarkdown);
	if (typedBlock === null) {
		const issue = makeIssue(
			"InvalidBlockPayload",
			`Block "${blockId}" has an invalid payload shape`,
			{ blockId, detail: parsedJson, entryIndex },
		);
		if (strict) {
			return { issues: [issue], nextIndex: index + 1 };
		}
		return {
			block: {
				block: "structured_raw",
				blockId,
				markdown: rawContent,
				reason: "invalid_payload",
				sourceMarkdown: rawMarkdown,
			},
			issues: [issue],
			nextIndex: index + 1,
		};
	}

	return {
		block: typedBlock,
		issues,
		nextIndex: index + 1,
	};
}

function pushFreeformBlock(
	blocks: EntryBlock[],
	lines: string[],
	start: number,
	end: number,
): void {
	if (end <= start) {
		return;
	}
	const markdown = lines.slice(start, end).join("");
	if (markdown.length === 0) {
		return;
	}
	blocks.push({
		block: "freeform",
		markdown,
		sourceMarkdown: markdown,
	});
}
