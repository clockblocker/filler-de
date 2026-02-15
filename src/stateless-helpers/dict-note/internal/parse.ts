import { z } from "zod/v3";
import { blockIdHelper } from "../../block-id";
import { noteMetadataHelper } from "../../note-metadata";
import type { DictEntry, EntrySection } from "../types";
import { ENTRY_SECTION_MARKER_RE, ENTRY_SEPARATOR_RE } from "./constants";

/** Passthrough schema — accepts any JSON object, preserves all keys */
const AnyObjectSchema = z.record(z.unknown());
const EntriesMetaSchema = z
	.object({ entries: z.record(AnyObjectSchema).optional() })
	.passthrough();

function parseSections(text: string): EntrySection[] {
	const markers: { index: number; kind: string; title: string }[] = [];
	const re = new RegExp(ENTRY_SECTION_MARKER_RE.source, "g");
	for (let m = re.exec(text); m !== null; m = re.exec(text)) {
		const kind = m[1];
		const title = m[2];
		if (kind && title) {
			markers.push({ index: m.index, kind, title });
		}
	}

	return markers.map((marker, i) => {
		const contentStart =
			marker.index +
			text.slice(marker.index).indexOf("</span>") +
			"</span>".length;
		const contentEnd =
			i + 1 < markers.length ? markers[i + 1]?.index : text.length;
		const content = text
			.slice(contentStart, contentEnd)
			.trim()
			.split("\n")
			.map((line) => line.trimEnd())
			.join("\n");
		return { content, kind: marker.kind, title: marker.title };
	});
}

function parseEntryChunk(
	chunk: string,
	metaByEntryId: Record<string, Record<string, unknown>>,
): DictEntry | null {
	// Find header line — first non-blank line containing ^blockId
	const lines = chunk.split("\n");
	let headerLine: string | undefined;
	for (const line of lines) {
		if (line.trim() === "") continue;
		if (blockIdHelper.extractFromLine(line) !== null) {
			headerLine = line;
			break;
		}
	}
	if (!headerLine) return null;

	const id = blockIdHelper.extractFromLine(headerLine);
	if (!id) return null;
	const headerContent = blockIdHelper.stripFromEnd(headerLine).trim();

	// Everything after the header line is section territory
	const headerEnd = chunk.indexOf(headerLine) + headerLine.length;
	const sectionsText = chunk.slice(headerEnd);
	const sections = parseSections(sectionsText);
	const meta = metaByEntryId[id] ?? {};

	return { headerContent, id, meta, sections };
}

export function parse(noteText: string): DictEntry[] {
	const { body } = noteMetadataHelper.decompose(noteText);
	// zod v3/v4 boundary: read() expects v4 ZodSchema, our schema is v3 — runtime-compatible
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const meta = noteMetadataHelper.read(
		noteText,
		EntriesMetaSchema as any,
	) as z.infer<typeof EntriesMetaSchema> | null;
	const metaByEntryId = meta?.entries ?? {};

	const chunks = body.split(ENTRY_SEPARATOR_RE);
	const entries: DictEntry[] = [];
	for (const chunk of chunks) {
		if (chunk.trim() === "") continue;
		const entry = parseEntryChunk(chunk, metaByEntryId);
		if (entry) entries.push(entry);
	}
	return entries;
}
