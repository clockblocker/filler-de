import { morphologyRelationHelper } from "../../../../../stateless-helpers/morphology-relation";
import { wikilinkHelper } from "../../../../../stateless-helpers/wikilink";

export type PropagationResult = { changed: boolean; content: string };

type ShouldSkipLine = (params: {
	candidateLine: string;
	currentBlockContent: string;
}) => boolean;

type SectionRange = {
	afterMarker: number;
	end: number;
	start: number;
};

function findSectionRange(
	content: string,
	sectionMarker: string,
): SectionRange | null {
	const start = content.indexOf(sectionMarker);
	if (start < 0) return null;

	const afterMarker = start + sectionMarker.length;
	const rest = content.slice(afterMarker);
	const nextSectionMatch = rest.match(/\n?<span class="entry_section_title /);
	const end =
		nextSectionMatch?.index !== undefined
			? afterMarker + nextSectionMatch.index
			: content.length;

	return { afterMarker, end, start };
}

export function splitLines(text: string): string[] {
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

export function extractFirstNonEmptyLine(
	raw: string | undefined,
): string | null {
	if (!raw) return null;

	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.length > 0) return trimmed;
	}
	return null;
}

export function buildUsedInLine(
	sourceLemma: string,
	sourceGloss: string | null,
): string {
	if (!sourceGloss) return `[[${sourceLemma}]] `;
	return `[[${sourceLemma}]] *(${sourceGloss})* `;
}

function normalizeLine(line: string): string {
	return line.trim();
}

function collectUniqueCandidates(lines: string[]): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const line of lines) {
		const normalized = normalizeLine(line);
		if (normalized.length === 0) continue;
		if (seen.has(normalized)) continue;
		seen.add(normalized);
		out.push(line);
	}
	return out;
}

function trimTrailingNewlines(text: string): string {
	return text.replace(/\n+$/g, "");
}

function appendUniqueLinesToBlock(params: {
	blockContent: string;
	lines: string[];
	shouldSkipLine?: ShouldSkipLine;
}): PropagationResult {
	const candidates = collectUniqueCandidates(params.lines);
	if (candidates.length === 0) {
		return { changed: false, content: params.blockContent };
	}

	const existingLines = splitLines(params.blockContent);
	const existingSet = new Set(existingLines);

	let current = trimTrailingNewlines(params.blockContent);
	const toAppend: string[] = [];

	for (const candidate of candidates) {
		const normalizedCandidate = normalizeLine(candidate);
		if (existingSet.has(normalizedCandidate)) continue;
		if (
			params.shouldSkipLine?.({
				candidateLine: candidate,
				currentBlockContent: current,
			})
		) {
			continue;
		}

		toAppend.push(candidate);
		existingSet.add(normalizedCandidate);
		current = current.length > 0 ? `${current}\n${candidate}` : candidate;
	}

	if (toAppend.length === 0) {
		return { changed: false, content: params.blockContent };
	}

	const content =
		trimTrailingNewlines(params.blockContent).length > 0
			? `${trimTrailingNewlines(params.blockContent)}\n${toAppend.join(
					"\n",
				)}`
			: toAppend.join("\n");
	return { changed: true, content };
}

export function blockHasWikilinkTarget(
	blockContent: string,
	target: string,
): boolean {
	const normalizedTarget = target.trim().toLowerCase();
	return wikilinkHelper
		.parse(blockContent)
		.some((link) => link.target.trim().toLowerCase() === normalizedTarget);
}

export function appendUniqueLinesToSection(params: {
	content: string;
	lines: string[];
	sectionMarker: string;
	shouldSkipLine?: ShouldSkipLine;
}): string {
	const sectionRange = findSectionRange(params.content, params.sectionMarker);
	if (!sectionRange) {
		const appended = appendUniqueLinesToBlock({
			blockContent: "",
			lines: params.lines,
			shouldSkipLine: params.shouldSkipLine,
		});
		if (!appended.changed) return params.content;
		return `${params.content.trimEnd()}\n${params.sectionMarker}\n${appended.content}`;
	}

	const sectionContent = params.content.slice(
		sectionRange.afterMarker,
		sectionRange.end,
	);
	const appended = appendUniqueLinesToBlock({
		blockContent: sectionContent,
		lines: params.lines,
		shouldSkipLine: params.shouldSkipLine,
	});
	if (!appended.changed) return params.content;

	return (
		params.content.slice(0, sectionRange.afterMarker) +
		`\n${appended.content}` +
		params.content.slice(sectionRange.end)
	);
}

function findNextBlockMarkerOffset(text: string): number {
	const regex = /\n([^\n]+)/g;
	for (const match of text.matchAll(regex)) {
		const index = match.index;
		const candidate = match[1];
		if (typeof index !== "number" || typeof candidate !== "string") {
			continue;
		}
		if (morphologyRelationHelper.parseMarker(candidate)) {
			return index;
		}
	}
	return text.length;
}

function findBlockStart(
	sectionContent: string,
	candidates: ReadonlyArray<string>,
): { marker: string; start: number } | null {
	let firstMatch: { marker: string; start: number } | null = null;
	for (const marker of candidates) {
		const start = sectionContent.indexOf(marker);
		if (start < 0) {
			continue;
		}
		if (!firstMatch || start < firstMatch.start) {
			firstMatch = { marker, start };
		}
	}
	return firstMatch;
}

export function appendUniqueLinesToSectionBlock(params: {
	blockMarker: string;
	blockMarkerAliases?: string[];
	content: string;
	lines: string[];
	sectionMarker: string;
	shouldSkipLine?: ShouldSkipLine;
}): string {
	const sectionRange = findSectionRange(params.content, params.sectionMarker);
	if (!sectionRange) {
		const appended = appendUniqueLinesToBlock({
			blockContent: "",
			lines: params.lines,
			shouldSkipLine: params.shouldSkipLine,
		});
		if (!appended.changed) return params.content;
		return `${params.content.trimEnd()}\n${params.sectionMarker}\n${params.blockMarker}\n${appended.content}`;
	}

	const sectionContent = params.content.slice(
		sectionRange.afterMarker,
		sectionRange.end,
	);
	const blockCandidates = [
		params.blockMarker,
		...(params.blockMarkerAliases ?? []),
	];
	const blockMatch = findBlockStart(sectionContent, blockCandidates);
	if (!blockMatch) {
		const appended = appendUniqueLinesToBlock({
			blockContent: "",
			lines: params.lines,
			shouldSkipLine: params.shouldSkipLine,
		});
		if (!appended.changed) return params.content;

		const normalizedSection = sectionContent.trimEnd();
		const withBlock =
			normalizedSection.length > 0
				? `${normalizedSection}\n${params.blockMarker}\n${appended.content}`
				: `${params.blockMarker}\n${appended.content}`;
		return (
			params.content.slice(0, sectionRange.afterMarker) +
			`\n${withBlock}` +
			params.content.slice(sectionRange.end)
		);
	}

	const blockBodyStart = blockMatch.start + blockMatch.marker.length;
	const afterBlock = sectionContent.slice(blockBodyStart);
	const blockBodyEnd = blockBodyStart + findNextBlockMarkerOffset(afterBlock);
	const blockContent = sectionContent.slice(blockBodyStart, blockBodyEnd);

	const appended = appendUniqueLinesToBlock({
		blockContent,
		lines: params.lines,
		shouldSkipLine: params.shouldSkipLine,
	});
	if (!appended.changed) return params.content;

	const updatedSection =
		sectionContent.slice(0, blockBodyStart) +
		`\n${appended.content}` +
		sectionContent.slice(blockBodyEnd);

	return (
		params.content.slice(0, sectionRange.afterMarker) +
		updatedSection +
		params.content.slice(sectionRange.end)
	);
}
