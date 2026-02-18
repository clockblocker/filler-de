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
	if (!sourceGloss) return `[[${sourceLemma}]]`;
	return `[[${sourceLemma}]] *(${sourceGloss})*`;
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
		out.push(normalized);
	}
	return out;
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

	let current = params.blockContent.trimEnd();
	const toAppend: string[] = [];

	for (const candidate of candidates) {
		if (existingSet.has(candidate)) continue;
		if (
			params.shouldSkipLine?.({
				candidateLine: candidate,
				currentBlockContent: current,
			})
		) {
			continue;
		}

		toAppend.push(candidate);
		existingSet.add(candidate);
		current = current.length > 0 ? `${current}\n${candidate}` : candidate;
	}

	if (toAppend.length === 0) {
		return { changed: false, content: params.blockContent };
	}

	const content =
		params.blockContent.trimEnd().length > 0
			? `${params.blockContent.trimEnd()}\n${toAppend.join("\n")}`
			: toAppend.join("\n");
	return { changed: true, content };
}

export function blockHasWikilinkTarget(
	blockContent: string,
	target: string,
): boolean {
	const normalizedTarget = wikilinkHelper.normalizeTarget(target);
	return wikilinkHelper
		.parse(blockContent)
		.some(
			(link) =>
				wikilinkHelper.normalizeTarget(link.target) ===
				normalizedTarget,
		);
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
	const match = text.match(/\n<[^>\n]+>/);
	if (match?.index === undefined) return text.length;
	return match.index;
}

export function appendUniqueLinesToSectionBlock(params: {
	blockMarker: string;
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
	const blockStart = sectionContent.indexOf(params.blockMarker);
	if (blockStart < 0) {
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

	const blockBodyStart = blockStart + params.blockMarker.length;
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
