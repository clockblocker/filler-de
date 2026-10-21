/**
 * Crossroad notes (ADR-0015): one per folded spelling, at
 * `crossroadNotePath(key)`, listing every Lemma with that spelling, with its
 * Reading notes, and every met Surface of another Lemma with it. The
 * plugin owns them; they hold no records. Their metadata, `crossroadNote`,
 * marks them as the store's and seals the renderings, so the user's text
 * in them is kept byte for byte.
 *
 * The store writes a Crossroad note in every commit that changes its
 * spelling's Lemmas or Surfaces, and never removes one: a spelling left
 * with nothing says "not classified yet". TODO(#114): the visible layout,
 * filling the empty file a click on an uncreated Crossroad link leaves, and
 * regenerating missing or stale Crossroads at startup.
 */

import {
	type BodySegment,
	BodyWriter,
	DEFAULT_PATHS,
	type RenderedBlock,
	readBody,
	renderingLines,
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

function lemmaLink(lemma: Dumling.Lemma<"de">): string {
	return wikilink(DEFAULT_PATHS.lemma(lemma), lemma.canonicalForm);
}

function readingLink(reading: Dumling.Reading<"de">): string {
	const emoji =
		"emojiDescription" in reading ? reading.emojiDescription : undefined;
	return wikilink(
		DEFAULT_PATHS.reading(reading),
		emoji ?? reading.lemma.canonicalForm,
	);
}

function blocksOf(content: CrossroadContent): RenderedBlock[] {
	const blocks: RenderedBlock[] = content.lemmas.map(
		({ lemma, readings }) => ({
			block: "crossroad_lemma",
			lines: renderingLines(
				`- ${lemmaLink(lemma)} (${lemma.kind})${readings.length > 0 ? `: ${readings.map(readingLink).join(" ")}` : ""}`,
			),
		}),
	);
	for (const { form, lemma } of content.surfaces)
		blocks.push({
			block: "crossroad_surface",
			lines: renderingLines(
				`- ${form} → ${lemmaLink(lemma)} (${lemma.kind})`,
			),
		});
	if (blocks.length === 0)
		blocks.push({ block: "crossroad_empty", lines: [NOT_CLASSIFIED_YET] });
	return blocks;
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
