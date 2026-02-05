import type { DictEntry } from "../types";
import { ENTRY_SECTION_CSS_CLASS, ENTRY_SEPARATOR } from "./constants";

export type SerializeResult = {
	body: string;
	meta: Record<string, unknown>;
};

function serializeEntry(entry: DictEntry): string {
	const headerLine = `${entry.headerContent} ^${entry.id}`;

	const sectionParts = entry.sections.map((s) => {
		const marker = `<span class="${ENTRY_SECTION_CSS_CLASS} ${ENTRY_SECTION_CSS_CLASS}_${s.kind}">${s.title}</span>`;
		return `${marker}\n${s.content}`;
	});

	if (sectionParts.length === 0) return headerLine;
	return `${headerLine}\n${sectionParts.join("\n")}`;
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
