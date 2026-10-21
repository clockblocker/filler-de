/**
 * Crossroad notes (ADR-0015): one per folded spelling, at
 * `crossroadNotePath(key)`, listing every Lemma with that spelling, with its
 * Reading notes, and every met Surface of another Lemma with it. The
 * plugin owns them; they hold no records. Their metadata, `crossroadNote`,
 * marks them as the store's and seals the renderings, so the user's text
 * in them is kept byte for byte.
 *
 * The layout is a compact router page under the dictionary's section
 * titles:
 *
 * ```
 * <span class="note_block_title note_block_title_eintraege">Einträge</span>
 * - der [[…/Fahrer|Fahrer]]: [[…/🚗 Fahrer|🚗]]
 * <span class="note_block_title note_block_title_surfaces">Begegnete Formen</span>
 * - Fahrern → der [[…/Fahrer|Fahrer]]
 * ```
 *
 * A spelling with nothing to list says `*Not classified yet*` under the
 * Einträge title. The store writes a Crossroad note in every commit that
 * changes its spelling's Lemmas or Surfaces, fills the empty file a click
 * on an uncreated Crossroad link leaves, regenerates missing or stale ones
 * after every full read of `Worter/`, and never removes one.
 */

import {
	articleOf,
	type BodySegment,
	BodyWriter,
	DEFAULT_PATHS,
	type RenderedBlock,
	type RenderingSeal,
	readBody,
	renderingLines,
	sealOf,
	wikilink,
} from "@textfresser/lemma-note-codec";
import type * as Dumling from "dumling/types";
import { z } from "zod";
import { freeformToAdd } from "./internal/dictionary-notes";
import {
	defineNestedNamespace,
	type MetadataFormat,
	noteMetadataHelper,
} from "./internal/note-metadata";

const SealSchema = z.strictObject({
	block: z.string(),
	hash: z.string().regex(/^[0-9a-f]{8}$/u),
	lines: z.number().int().positive(),
});

const CrossroadNoteSchema = z.strictObject({
	/** The spelling's `canonicalFormKey`. */
	key: z.string(),
	language: z.string(),
	rendering: z.array(SealSchema),
});

type CrossroadNoteData = z.infer<typeof CrossroadNoteSchema>;

/** A Crossroad note's metadata: `crossroadNote`. */
export const CrossroadNoteMetadata = defineNestedNamespace({
	escapeLinksInFrontmatter: true,
	key: "crossroadNote",
	migrations: {},
	name: "crossroad-note",
	schema: CrossroadNoteSchema,
	version: 1,
});

/** What a Crossroad note lists: its spelling's Lemmas, and the Surfaces of others. */
export type CrossroadContent = {
	readonly key: string;
	readonly lemmas: readonly {
		readonly lemma: Dumling.Lemma<"de">;
		readonly readings: readonly Dumling.Reading<"de">[];
	}[];
	readonly surfaces: readonly {
		readonly form: string;
		readonly lemma: Dumling.Lemma<"de">;
	}[];
};

const NOT_CLASSIFIED_YET = "*Not classified yet*";

/** The section titles, in the dictionary's style (styles.css, #103, #104). */
const TITLES = {
	lemmas: { className: "eintraege", text: "Einträge" },
	surfaces: { className: "surfaces", text: "Begegnete Formen" },
} as const;

const titleLine = ({ className, text }: (typeof TITLES)[keyof typeof TITLES]) =>
	`<span class="note_block_title note_block_title_${className}">${text}</span>`;

/** A Lemma as a Crossroad names it: `der [[…|See]]`, or `[[…|gehen]] (VERB)`. */
function lemmaLabel(lemma: Dumling.Lemma<"de">): string {
	const link = wikilink(DEFAULT_PATHS.lemma(lemma), lemma.canonicalForm);
	const article = articleOf(lemma);
	return article === undefined
		? `${link} (${lemma.kind})`
		: `${article} ${link}`;
}

function readingLink(reading: Dumling.Reading<"de">): string {
	const emoji =
		"emojiDescription" in reading ? reading.emojiDescription : undefined;
	return wikilink(
		DEFAULT_PATHS.reading(reading),
		emoji ?? reading.lemma.canonicalForm,
	);
}

/** One line per Lemma and per met Surface, each its own Block, titled per section. */
function blocksOf(content: CrossroadContent): RenderedBlock[] {
	const titled = (
		title: (typeof TITLES)[keyof typeof TITLES],
		index: number,
		line: string,
	) => [...(index === 0 ? [titleLine(title)] : []), ...renderingLines(line)];
	const blocks: RenderedBlock[] = content.lemmas.map(
		({ lemma, readings }, index) => ({
			block: "crossroad_lemma",
			lines: titled(
				TITLES.lemmas,
				index,
				`- ${lemmaLabel(lemma)}${readings.length > 0 ? `: ${readings.map(readingLink).join(" ")}` : ""}`,
			),
		}),
	);
	content.surfaces.forEach(({ form, lemma }, index) => {
		blocks.push({
			block: "crossroad_surface",
			lines: titled(
				TITLES.surfaces,
				index,
				`- ${form} → ${lemmaLabel(lemma)}`,
			),
		});
	});
	if (blocks.length === 0)
		blocks.push({
			block: "crossroad_empty",
			lines: [titleLine(TITLES.lemmas), NOT_CLASSIFIED_YET],
		});
	return blocks;
}

/** Whether a Crossroad lists nothing, so it says "not classified yet". */
export const listsNothing = (content: CrossroadContent): boolean =>
	content.lemmas.length === 0 && content.surfaces.length === 0;

/**
 * Whether a Crossroad note's metadata already holds what `content` renders:
 * its key and its renderings' seals. It is what tells a stale Crossroad
 * note without reading its file.
 */
export function rendersAs(
	metadata: {
		readonly key: string;
		readonly rendering: readonly RenderingSeal[];
	},
	content: CrossroadContent,
): boolean {
	if (metadata.key !== content.key) return false;
	const wanted = blocksOf(content).map(sealOf);
	return (
		wanted.length === metadata.rendering.length &&
		wanted.every(
			(seal, index) =>
				seal.block === metadata.rendering[index]?.block &&
				seal.hash === metadata.rendering[index]?.hash &&
				seal.lines === metadata.rendering[index]?.lines,
		)
	);
}

/** A Crossroad note's body and metadata, keeping the user text of `previous`. */
function serializeCrossroad(
	content: CrossroadContent,
	previous: readonly BodySegment[],
	extra: readonly string[],
): { readonly body: string; readonly metadata: CrossroadNoteData } {
	const writer = new BodyWriter();
	for (const block of blocksOf(content)) writer.block(block);
	const held = previous.flatMap((segment) =>
		segment.type === "freeform" ? [segment.text] : [],
	);
	// Text it already holds is not added again, so a retried move stays once.
	const freeform = [...held, ...freeformToAdd(held, extra)];
	if (freeform.length > 0) writer.gap(1).text(freeform.join("\n\n"));
	const { body, rendering } = writer.finish();
	return { body, metadata: { key: content.key, language: "de", rendering } };
}

/** A file's Crossroad metadata as it reads, if any. */
export function crossroadMetadataOf(
	content: string,
): CrossroadNoteData | undefined {
	const read = noteMetadataHelper.inspect(
		content,
		CrossroadNoteMetadata,
		"Hidden",
	);
	return read.kind === "Valid" ? read.value : undefined;
}

/**
 * Rewrites a file as the Crossroad note of `content`, keeping every line
 * of the user's text and adding `extra` after it, such as the text of a
 * removed Lemma's notes. An empty file, or one with text but no Crossroad
 * metadata, keeps all of it as freeform.
 */
export function writeCrossroadNote(
	content: CrossroadContent,
	format: MetadataFormat,
	extra: readonly string[] = [],
): (current: string) => string {
	return (current) => {
		const seals = crossroadMetadataOf(current)?.rendering ?? [];
		const previous = readBody(noteMetadataHelper.body(current), seals);
		const { body, metadata } = serializeCrossroad(content, previous, extra);
		const withBody = noteMetadataHelper.mapBody(() => body)(current);
		return noteMetadataHelper.write(
			CrossroadNoteMetadata,
			metadata,
			format,
		)(withBody);
	};
}
