import { canonicalJson } from "common-utils";
import type { PendingSemanticRelationRecord } from "dumdict";
import { readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import { blockIdsOf } from "./block-ids";
import {
	CANONICAL_BLOCK_ORDER,
	KNOWLEDGE_BLOCKS,
	type ProjectionBlockKind,
	type SerializedBlockKind,
	type TypedBlockKind,
} from "./blocks";
import {
	EMPTY_DOCUMENT,
	type LemmaNoteDocument,
	type NoteBlock,
	type NotePart,
	renderingSeal,
	trimmedRaw,
	withoutBlockIds,
} from "./document";
import {
	BLOCK_SECTIONS,
	DEFAULT_LINKS,
	DEFAULT_TITLES,
	defaultHeader,
	type LinkRenderer,
	NOTE_PLACEHOLDER,
	PARAGRAPH_KINDS,
	PART_SEPARATOR,
	type Projections,
	RENDERERS,
	type ReadingProjectionContext,
	renderInverseRelations,
	type SectionKind,
	sanitizeRendering,
	sectionTitle,
} from "./render";
import type { LemmaNoteData } from "./types";

/** Data that no valid note holds, such as a pending relation with no Reading. */
export class LemmaNoteSerializeError extends Error {
	override readonly name = "LemmaNoteSerializeError";
}

export type SerializeOptions<L extends Dumling.Language> = {
	readonly projections?: Projections<L>;
};

/** A JSON string token, escapes included. */
const JSON_STRING_PATTERN = /"(?:[^"\\]|\\.)*"/gu;

/**
 * A serialized payload: canonical JSON on one line. Inside its strings, `%`
 * is written as `\u0025`, so no payload can close its Obsidian comment, and
 * `[` as `\u005b`, so no payload holds a wikilink, an embed or a Markdown
 * link: Obsidian renders and indexes those even inside a comment. Both are
 * plain JSON escapes, so `JSON.parse` reads the payload back unchanged.
 */
function encodePayload(value: unknown): string {
	let json: string;
	try {
		json = canonicalJson(value);
	} catch (error) {
		throw new LemmaNoteSerializeError(String(error));
	}
	return json.replace(JSON_STRING_PATTERN, (token) =>
		token.replaceAll("%", "\\u0025").replaceAll("[", "\\u005b"),
	);
}

type Render = {
	readonly links: LinkRenderer;
	readonly titles: Readonly<Record<SectionKind, string>>;
};

/**
 * A typed Block: its marker, sealing the rendering it is followed by, so
 * parse can tell that rendering from anything a user types around it.
 */
function typedBlock(
	kind: TypedBlockKind,
	payload: string | undefined,
	rendering: string | undefined,
): string {
	const seal =
		rendering === undefined ? "" : renderingSeal(rendering.split("\n"));
	const marker = `%%tf:${kind}${seal}${payload === undefined ? "" : ` ${payload}`}%%`;
	return rendering === undefined ? marker : `${marker}\n${rendering}`;
}

/**
 * One typed Block before layout: its encoded payload, for a serialized
 * Block, and its visible content, before its section's title. A projection
 * Block without content is left out.
 */
type BlockItem = {
	readonly kind: TypedBlockKind;
	readonly payload?: string;
	readonly content?: string;
};

/**
 * The lines between a section and the next (spec: Layout): a blank line
 * after the header, two after the Note section and its freeform, and none
 * between other sections, as the dictionary notes stood.
 */
function gapAfter(section: SectionKind | "head"): string {
	if (section === "head") return "\n\n";
	if (section === "note") return "\n\n\n";
	return "\n";
}

/**
 * Lays a part out as the dictionary notes did (spec: Layout): the part
 * marker and its `head` Blocks on consecutive lines, then one section per
 * run of Blocks that share one, its title on the first rendering. With
 * comment lines hidden, a section reads as its title over its lines. The
 * part's freeform and unknown Blocks, `kept`, stand directly under its Note
 * section, or after a blank line at its end when it has none.
 */
function layoutPart(
	marker: string,
	items: readonly BlockItem[],
	{ titles }: Render,
	kept: readonly string[] = [],
): string {
	const groups: { section: SectionKind | "head"; blocks: string[] }[] = [
		{ blocks: [marker], section: "head" },
	];
	let titled = false;
	for (const { content, kind, payload } of items) {
		const section = BLOCK_SECTIONS[kind];
		const last = groups.at(-1);
		const group =
			last !== undefined && last.section === section
				? last
				: { blocks: [], section };
		if (group !== last) {
			groups.push(group);
			titled = false;
		}
		const clean =
			content === undefined
				? ""
				: sanitizeRendering(content, PARAGRAPH_KINDS.has(kind));
		let rendering =
			clean.length > 0 ||
			(kind === "notes_title" && content !== undefined)
				? clean
				: undefined;
		if (rendering !== undefined && section !== "head" && !titled) {
			const title = sanitizeRendering(titles[section]);
			if (title.length > 0) {
				const line = sectionTitle(section, title);
				rendering =
					rendering.length > 0 ? `${line}\n${rendering}` : line;
			}
			titled = true;
		}
		if (rendering !== undefined && rendering.length === 0)
			rendering = undefined;
		if (rendering === undefined && payload === undefined) continue;
		group.blocks.push(typedBlock(kind, payload, rendering));
	}
	const sections = groups
		.filter((group) => group.blocks.length > 0)
		.map((group) => ({
			section: group.section,
			text: group.blocks.join("\n"),
		}));
	const freeform = kept.join("\n\n");
	const note = sections.find((section) => section.section === "note");
	if (note !== undefined && freeform.length > 0)
		note.text = `${note.text}\n${freeform}`;
	let text = "";
	sections.forEach((section, index) => {
		const previous = sections[index - 1];
		text +=
			previous === undefined
				? section.text
				: `${gapAfter(previous.section)}${section.text}`;
	});
	return note === undefined && freeform.length > 0
		? `${text}\n\n${freeform}`
		: text;
}

/**
 * A serialized Block with its payload and its default rendering, of `shown`
 * when it shows less than the payload holds.
 */
function serializedItem(
	kind: SerializedBlockKind,
	shown: unknown,
	{ links }: Render,
	value: unknown = shown,
): BlockItem {
	const content = RENDERERS[kind]?.(shown, links);
	return {
		kind,
		payload: encodePayload(value),
		...(content === undefined ? {} : { content }),
	};
}

const isEmpty = (value: unknown) =>
	value === undefined ||
	value === "" ||
	(Array.isArray(value) && value.length === 0);

/**
 * Freeform and unknown Blocks, which serialization keeps as they are. An
 * edited rendering loses only its Block IDs, which the re-rendered Block
 * carries, so each ID occurs once in the note. A freeform Block holding
 * only the Note placeholder is no user text, so it goes, and the placeholder
 * is rendered again where nothing else is written.
 */
function keptBlocks(blocks: readonly NoteBlock[]): string[] {
	return blocks.flatMap((block) => {
		if (block.type !== "freeform" && block.type !== "unknown") return [];
		const text = trimmedRaw(
			block.type === "freeform" && block.demoted === true
				? { ...block, raw: withoutBlockIds(block.raw) }
				: block,
		);
		if (text.length === 0) return [];
		if (block.type === "freeform" && text.trim() === NOTE_PLACEHOLDER)
			return [];
		return [text];
	});
}

/**
 * Writes a Lemma note in canonical order (spec: Serialization): the
 * document's preamble, the Lemma part, then a part per Reading Entry and
 * per owned Surface Entry, in data order. Typed Blocks come from `data`;
 * projection Blocks from `options.projections`; the document only
 * contributes its freeform and unknown Blocks, kept byte for byte in the
 * part they were in: under a Reading part's Note title, at the end of any
 * other part. An edited rendering loses its Block IDs, and a Block holding
 * only the Note placeholder goes. Blocks of a part the data no longer has
 * move to the end of the Lemma part, so no user content is lost.
 *
 * It throws {@link LemmaNoteSerializeError} for data no valid note holds;
 * records that dumdict validated never do.
 */
export function serialize<L extends Dumling.Language>(
	document: LemmaNoteDocument | undefined,
	data: LemmaNoteData<L>,
	options: SerializeOptions<L> = {},
): string {
	const { projections = {} } = options;
	const render: Render = {
		links: { ...DEFAULT_LINKS, ...projections.links },
		titles: { ...DEFAULT_TITLES, ...projections.titles },
	};
	const source = document ?? EMPTY_DOCUMENT;
	const ids = blockIdsOf(data);
	const lemma = data.lemmaRecord.lemma;

	const readingKeys = data.readingEntries.map((entry) =>
		readingIdentityKey(entry.reading),
	);
	if (new Set(readingKeys).size !== readingKeys.length)
		throw new LemmaNoteSerializeError(
			"Two Reading Entries hold one Reading",
		);
	const surfaceIds = data.ownedSurfaceEntries.map((entry) => entry.id);
	if (new Set(surfaceIds).size !== surfaceIds.length)
		throw new LemmaNoteSerializeError(
			"Two Surface Entries hold one Surface",
		);
	const pendingByReading = new Map<
		string,
		PendingSemanticRelationRecord<L>[]
	>();
	for (const record of data.pendingRelations) {
		const key = readingIdentityKey(record.sourceReading);
		if (!readingKeys.includes(key))
			throw new LemmaNoteSerializeError(
				"A pending relation's source Reading is not in the note",
			);
		pendingByReading.set(key, [
			...(pendingByReading.get(key) ?? []),
			record,
		]);
	}

	const used = new Set<NotePart>();
	const take = (scope: NotePart["scope"], blockId?: string) => {
		const part = source.parts.find(
			(candidate) =>
				!used.has(candidate) &&
				candidate.scope === scope &&
				(scope === "lemma" || candidate.blockId === blockId),
		);
		if (part !== undefined) used.add(part);
		return part === undefined ? [] : keptBlocks(part.blocks);
	};

	const lemmaKept = take("lemma");
	/** The separator lines every part after the first opens with. */
	let visibleParts = 0;
	const separated = (line: string) =>
		visibleParts++ === 0 ? line : `${PART_SEPARATOR}\n${line}`;
	const readingParts = data.readingEntries.map((entry, index) => {
		const key = readingKeys[index] ?? "";
		const blockId = ids.readings.get(key) ?? "";
		const context: ReadingProjectionContext<L> = {
			blockId,
			entry,
			lemma,
			links: render.links,
			ownedSurfaces: data.ownedSurfaceEntries,
		};
		const knowledge: Readonly<Record<string, unknown>> =
			entry.knowledge ?? {};
		const pending = pendingByReading.get(key) ?? [];
		const payloads: Partial<Record<SerializedBlockKind, unknown>> = {
			attestation: entry.attestationLinks,
			attested_translation: entry.attestedTranslations,
			notes: entry.notes,
			pending_relation:
				pending.length === 0
					? undefined
					: pending.map(({ pending: relation, resolvedLemma }) =>
							// A resolved Shadow relation keeps the Lemma it resolved to.
							resolvedLemma === undefined
								? relation
								: { ...relation, resolvedLemma },
						),
			reading:
				"emojiDescription" in entry.reading
					? entry.reading.emojiDescription
					: undefined,
		};
		const aspects: readonly string[] = Object.values(KNOWLEDGE_BLOCKS);
		const unplaced = Object.keys(knowledge).filter(
			(aspect) => !aspects.includes(aspect),
		);
		if (unplaced.length > 0)
			throw new LemmaNoteSerializeError(
				`No Block holds the Knowledge aspect ${unplaced.join(", ")}`,
			);
		for (const [kind, aspect] of Object.entries(KNOWLEDGE_BLOCKS)) {
			payloads[kind as SerializedBlockKind] = knowledge[aspect];
		}
		const kept = take("reading", blockId);
		const projected: Record<ProjectionBlockKind, string | undefined> = {
			header: separated(
				`${sanitizeRendering((projections.header ?? defaultHeader)(context))} ^${blockId}`,
			),
			inflection: projections.inflection?.(context),
			inverse_relation: (() => {
				const edges = projections.inverseRelations?.(context);
				return edges === undefined || edges.length === 0
					? undefined
					: renderInverseRelations(edges, render.links);
			})(),
			// The Note title always stands under Deine Kontexte, over the
			// notes and the freeform text kept below it, so a user knows
			// where to write; the placeholder says so until they do.
			notes_placeholder:
				kept.length === 0 && isEmpty(entry.notes)
					? NOTE_PLACEHOLDER
					: undefined,
			notes_title: "",
			tags: projections
				.tags?.(context)
				?.map((tag) => `#${tag}`)
				.join(" "),
		};
		const translated = new Set<string>(
			Object.values(entry.knowledge?.translations ?? {}).flat(),
		);
		const items = CANONICAL_BLOCK_ORDER.reading.flatMap(
			(kind): BlockItem[] => {
				if (kind in projected) {
					const content = projected[kind as ProjectionBlockKind];
					return content === undefined ? [] : [{ content, kind }];
				}
				const value = payloads[kind as SerializedBlockKind];
				if (isEmpty(value)) return [];
				// Übersetzung shows an attested translation once, so one the
				// Reading's translations already list shows only there.
				return [
					serializedItem(
						kind as SerializedBlockKind,
						kind === "attested_translation"
							? entry.attestedTranslations.filter(
									(word) => !translated.has(word),
								)
							: value,
						render,
						value,
					),
				];
			},
		);
		return layoutPart(
			`%%tf-part:reading ${blockId}%%`,
			items,
			render,
			kept,
		);
	});

	const surfaceParts = data.ownedSurfaceEntries.map((entry) => {
		const blockId = ids.surfaces.get(entry.id) ?? "";
		const { surface } = entry;
		const inflectional: unknown = (surface as Record<string, unknown>)
			.inflectionalFeatures;
		const features = Object.values(
			(inflectional ?? {}) as Record<string, unknown>,
		).filter((value) => typeof value === "string");
		const shown = `${surface.normalizedSurface}${features.length === 0 ? "" : ` (${features.join(" ")})`}`;
		const payloads: Partial<Record<SerializedBlockKind, unknown>> = {
			attestation: entry.attestations,
			attested_translation: entry.attestedTranslations,
			notes: entry.notes,
		};
		const items = CANONICAL_BLOCK_ORDER.surface.flatMap(
			(kind): BlockItem[] => {
				if (kind === "surface")
					return [
						{
							content: separated(
								`${sanitizeRendering(shown)} ^${blockId}`,
							),
							kind,
							payload: encodePayload(surface),
						},
					];
				const value = payloads[kind];
				return isEmpty(value)
					? []
					: [serializedItem(kind, value, render)];
			},
		);
		return layoutPart(
			`%%tf-part:surface ${blockId}%%`,
			items,
			render,
			take("surface", blockId),
		);
	});

	const orphans = source.parts
		.filter((part) => !used.has(part))
		.flatMap((part) => keptBlocks(part.blocks));

	const segments = [
		...keptBlocks(source.preamble),
		layoutPart(
			"%%tf-part:lemma%%",
			[{ kind: "identity", payload: encodePayload(lemma) }],
			render,
		),
		...lemmaKept,
		...orphans,
		...readingParts,
		...surfaceParts,
	];
	return `${segments.join("\n\n")}\n`;
}
