import type { DictEntry } from "../types";
import { ENTRY_SECTION_CSS_CLASS, ENTRY_SEPARATOR } from "./constants";

export type SerializeResult = {
	body: string;
	meta: Record<string, unknown>;
};

/** CSS suffixes whose content should NOT get trailing spaces. */
const NO_TRAILING_SPACE = new Set(["kontexte", "notizen"]);

function addTrailingSpaces(content: string): string {
	return content
		.split("\n")
		.map((line) => `${line} `)
		.join("\n");
}

function serializeEntry(entry: DictEntry): string {
	const headerLine = `${entry.headerContent} ^${entry.id}`;

	const sectionParts = entry.sections.map((s) => {
		const marker = `<span class="${ENTRY_SECTION_CSS_CLASS} ${ENTRY_SECTION_CSS_CLASS}_${s.kind}">${s.title}</span>`;
		const content = NO_TRAILING_SPACE.has(s.kind)
			? s.content
			: addTrailingSpaces(s.content);
		return `\n${marker}\n${content}`;
	});

	if (sectionParts.length === 0) return `\n${headerLine}\n`;
	return `\n${headerLine}\n\n${sectionParts.join("\n")}`;
}

export function serialize(entries: DictEntry[]): SerializeResult {
	const body = entries.map(serializeEntry).join(ENTRY_SEPARATOR);

	const entriesMeta: Record<string, Record<string, unknown>> = {};
	for (const e of entries) {
		if (Object.keys(e.meta).length > 0) {
			entriesMeta[e.id] = e.meta;
		}
	}

	const meta: Record<string, unknown> =
		Object.keys(entriesMeta).length > 0 ? { entries: entriesMeta } : {};

	return { body, meta };
}
