import { LemmaBundleMetadata, readBundle } from "./bundle";
import { noteMetadataHelper } from "./internal/note-metadata";

/** What placing freeform text into a Lemma bundle came to. */
export type FreeformInsert =
	| { readonly _tag: "Inserted"; readonly content: string }
	| { readonly _tag: "AlreadyThere" }
	| { readonly _tag: "Refused"; readonly reason: string };

/** Text without CRs, blank edge lines and trailing whitespace. */
function normalizeFreeform(text: string): string {
	return text
		.replace(/\r\n?/gu, "\n")
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/u, ""))
		.join("\n")
		.replace(/^\n+|\n+$/gu, "");
}

/**
 * Whether `body` is whole paragraphs of `held`: all of it, or a run of it
 * between blank lines. Freeform text placed next to other freeform text
 * parses back as one run, so a placement is found again this way, while a
 * short text inside a longer paragraph is not mistaken for it.
 */
function holdsParagraphs(held: string, body: string): boolean {
	return (
		held === body ||
		held.startsWith(`${body}\n\n`) ||
		held.endsWith(`\n\n${body}`) ||
		held.includes(`\n\n${body}\n\n`)
	);
}

const NOTE_BLOCKS: ReadonlySet<string> = new Set(["notes_title", "notes"]);

/**
 * TODO(#113): places `text` as freeform in the Reading part whose header
 * carries `readingBlockId`: in place of its Note placeholder, or under its
 * Note title, notes and freeform, where the codec keeps freeform. With no
 * such Reading it ends the Lemma part. Only body lines change: the records
 * and seals stay, so the bundle parses back to the same data. Text that is
 * already freeform of the bundle is not added twice.
 */
export function insertFreeformBlock(
	content: string,
	readingBlockId: string | undefined,
	text: string,
): FreeformInsert {
	const body = normalizeFreeform(text);
	if (body.trim() === "")
		return { _tag: "Refused", reason: "the text is empty" };
	const read = readBundle(content);
	if (!read.data.ok)
		return { _tag: "Refused", reason: "the note holds no Lemma bundle" };
	const held = read.segments.flatMap((segment) =>
		segment.type === "freeform" ? [normalizeFreeform(segment.text)] : [],
	);
	if (held.some((paragraphs) => holdsParagraphs(paragraphs, body)))
		return { _tag: "AlreadyThere" };

	const key = [...read.data.readingBlockIds].find(
		([, id]) => id === readingBlockId,
	)?.[0];
	const owner = key === undefined ? 0 : read.readingKeys.indexOf(key) + 1;
	const segments = read.segments.filter((segment) => segment.owner === owner);
	const placeholder = segments.find(
		(segment) =>
			segment.type === "rendering" &&
			segment.block === "notes_placeholder",
	);
	const lines = [...read.lines];
	const added = body.split("\n");
	let metadata = read.stored;
	if (owner > 0 && placeholder?.type === "rendering" && metadata) {
		lines.splice(
			placeholder.start,
			placeholder.end - placeholder.start,
			...added,
		);
		// The placeholder is gone, so its seal goes too, as serialize writes it.
		const { lemma, readings } = metadata.value;
		let offset = lemma.rendering.length;
		for (const part of readings.slice(0, owner - 1))
			offset += part.rendering.length;
		const local = placeholder.seal - offset;
		metadata = {
			...metadata,
			value: {
				lemma,
				readings: readings.map((part, at) =>
					at === owner - 1
						? {
								...part,
								rendering: part.rendering.filter(
									(_, position) => position !== local,
								),
							}
						: part,
				),
			},
		};
	} else {
		const anchor =
			owner > 0
				? segments.findLastIndex(
						(segment) =>
							segment.type === "rendering" &&
							NOTE_BLOCKS.has(segment.block),
					)
				: segments.length - 1;
		let last = segments[anchor];
		for (let at = anchor + 1; owner > 0 && at < segments.length; at++) {
			const next = segments[at];
			if (next?.type !== "freeform") break;
			last = next;
		}
		if (last === undefined)
			return { _tag: "Refused", reason: "the part has no Note section" };
		// Next to freeform, a blank line keeps the text a paragraph of its own;
		// after the Lemma part's last line, blank lines set it apart.
		const separated = last.type === "freeform" || owner === 0;
		lines.splice(last.end, 0, ...(separated ? ["", ...added] : added));
	}
	const placed = `${lines.join("\n")}\n`;
	const withBody = noteMetadataHelper.mapBody(() => placed)(content);
	return {
		_tag: "Inserted",
		content:
			metadata === undefined || metadata === read.stored
				? withBody
				: noteMetadataHelper.write(
						LemmaBundleMetadata,
						metadata.value,
						metadata.format,
					)(withBody),
	};
}

/** Whether `text` stands in one of the bundle's freeform runs, as parsed back. */
export function holdsFreeformBlock(content: string, text: string): boolean {
	const body = normalizeFreeform(text);
	return readBundle(content).segments.some(
		(segment) =>
			segment.type === "freeform" &&
			holdsParagraphs(normalizeFreeform(segment.text), body),
	);
}
