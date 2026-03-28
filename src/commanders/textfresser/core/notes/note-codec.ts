import { z } from "zod/v3";
import { blockIdHelper } from "../../../../stateless-helpers/block-id";
import { noteMetadataHelper } from "../../../../stateless-helpers/note-metadata";
import {
	findSectionSpecByMarker,
	type LanguagePack,
} from "../contracts/language-pack";
import type { NoteEntry, RawNoteSection, SerializeNoteResult } from "./types";
import { buildSectionMarker, ENTRY_SEPARATOR_RE } from "../../domain/dict-note/internal/constants";

const AnyObjectSchema = z.record(z.unknown());
const EntriesMetaSchema = z
	.object({ entries: z.record(AnyObjectSchema).optional() })
	.passthrough();

const ENTRY_SECTION_MARKER_WITH_MATCH_RE =
	/<span class="entry_section_title entry_section_title_(\w+)">([^<]+)<\/span>/g;

const NO_TRAILING_SPACE = new Set(["kontexte", "notizen"]);

type ParsedSectionMarker = {
	index: number;
	marker: string;
	markerEnd: number;
	title: string;
};

function normalizeTypedContent(text: string): string {
	return text
		.trim()
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n");
}

function addTrailingSpaces(content: string): string {
	return content
		.split("\n")
		.map((line) => `${line} `)
		.join("\n");
}

function collectSectionMarkers(text: string): ParsedSectionMarker[] {
	const markers: ParsedSectionMarker[] = [];
	for (const match of text.matchAll(ENTRY_SECTION_MARKER_WITH_MATCH_RE)) {
		const index = match.index;
		const marker = match[1];
		const title = match[2];
		const fullMatch = match[0];
		if (
			typeof index !== "number" ||
			typeof marker !== "string" ||
			typeof title !== "string" ||
			typeof fullMatch !== "string"
		) {
			continue;
		}
		markers.push({
			index,
			marker,
			markerEnd: index + fullMatch.length,
			title,
		});
	}
	return markers;
}

function pushLooseRawSection(
	sections: NoteEntry["sections"],
	rawBlock: string,
): void {
	if (rawBlock.length === 0) {
		return;
	}
	sections.push({
		kind: "raw",
		rawBlock,
	});
}

function parseEntryChunk(
	chunk: string,
	pack: LanguagePack,
	metaByEntryId: Record<string, Record<string, unknown>>,
): NoteEntry | null {
	const lines = chunk.split("\n");
	let headerLine: string | undefined;
	for (const line of lines) {
		if (line.trim() === "") {
			continue;
		}
		if (blockIdHelper.extractFromLine(line) !== null) {
			headerLine = line;
			break;
		}
	}

	if (!headerLine) {
		return null;
	}

	const id = blockIdHelper.extractFromLine(headerLine);
	if (!id) {
		return null;
	}
	const headerContent = blockIdHelper.stripFromEnd(headerLine).trim();
	const headerEnd = chunk.indexOf(headerLine) + headerLine.length;
	const sectionsText = chunk.slice(headerEnd);
	const markers = collectSectionMarkers(sectionsText);
	const sections: NoteEntry["sections"] = [];
	const occurrenceByMarker = new Map<string, number>();
	let cursor = 0;

	for (let index = 0; index < markers.length; index += 1) {
		const marker = markers[index];
		if (!marker) {
			continue;
		}
		pushLooseRawSection(sections, sectionsText.slice(cursor, marker.index));

		const nextMarker = markers[index + 1];
		const sectionEnd = nextMarker ? nextMarker.index : sectionsText.length;
		const rawBlock = sectionsText.slice(marker.index, sectionEnd);
		const sectionBody = sectionsText.slice(marker.markerEnd, sectionEnd);
		const contentWithoutTrailingWhitespace = sectionBody.replace(/\s+$/u, "");
		const trailingRaw = sectionBody.slice(
			contentWithoutTrailingWhitespace.length,
		);
		const content = normalizeTypedContent(sectionBody);
		const occurrence = occurrenceByMarker.get(marker.marker) ?? 0;
		occurrenceByMarker.set(marker.marker, occurrence + 1);
		const sectionSpec = findSectionSpecByMarker(pack, marker.marker);

		if (
			sectionSpec &&
			sectionSpec.claimPolicy.canClaim({
				content,
				marker: marker.marker,
				occurrence,
				title: marker.title,
			})
		) {
			sections.push({
				content,
				key: sectionSpec.key,
				kind: "typed",
				marker: marker.marker,
				title: marker.title,
			});
			pushLooseRawSection(sections, trailingRaw);
		} else {
			const rawSection: RawNoteSection = {
				kind: "raw",
				rawBlock,
			};
			if (sectionSpec) {
				rawSection.key = sectionSpec.key;
			}
			rawSection.marker = marker.marker;
			rawSection.title = marker.title;
			sections.push(rawSection);
		}

		cursor = sectionEnd;
	}

	pushLooseRawSection(sections, sectionsText.slice(cursor));

	return {
		headerContent,
		id,
		meta: metaByEntryId[id] ?? {},
		sections,
	};
}

function serializeEntry(entry: NoteEntry): string {
	const headerLine = `${entry.headerContent} ^${entry.id}`;
	let output = `\n${headerLine}`;

	if (entry.sections.length === 0) {
		return `${output}\n`;
	}

	entry.sections.forEach((section, index) => {
		const previous = index > 0 ? entry.sections[index - 1] : undefined;
		if (section.kind === "raw") {
			const prefix =
				previous?.kind === "typed" && !section.rawBlock.startsWith("\n")
					? "\n"
					: "";
			output += `${prefix}${section.rawBlock}`;
			return;
		}

		const marker = buildSectionMarker(section.marker, section.title);
		const content = NO_TRAILING_SPACE.has(section.marker)
			? section.content
			: addTrailingSpaces(section.content);
		const prefix = previous?.kind === "raw" ? "" : "\n\n";
		output += `${prefix}${marker}\n${content}`;
	});

	return output;
}

export function createNoteCodec(pack: LanguagePack) {
	return {
		parse(noteText: string): NoteEntry[] {
			const { body } = noteMetadataHelper.decompose(noteText);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const meta = noteMetadataHelper.read(noteText, EntriesMetaSchema as any) as
				| z.infer<typeof EntriesMetaSchema>
				| null;
			const metaByEntryId = meta?.entries ?? {};
			const chunks = body.split(ENTRY_SEPARATOR_RE);
			const entries: NoteEntry[] = [];
			for (const chunk of chunks) {
				if (chunk.trim() === "") {
					continue;
				}
				const entry = parseEntryChunk(chunk, pack, metaByEntryId);
				if (entry) {
					entries.push(entry);
				}
			}
			return entries;
		},
		serialize(entries: NoteEntry[]): SerializeNoteResult {
			const body = entries.map(serializeEntry).join("\n\n\n---\n---\n\n\n");
			const entriesMeta: Record<string, Record<string, unknown>> = {};
			for (const entry of entries) {
				if (Object.keys(entry.meta).length > 0) {
					entriesMeta[entry.id] = entry.meta;
				}
			}

			return {
				body,
				meta:
					Object.keys(entriesMeta).length > 0
						? { entries: entriesMeta }
						: {},
			};
		},
	};
}
