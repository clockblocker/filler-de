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
} from "./document";
import {
	DEFAULT_LABELS,
	DEFAULT_LINKS,
	defaultHeader,
	type LinkRenderer,
	type Projections,
	RENDERERS,
	type ReadingProjectionContext,
	renderInverseRelations,
	sanitizeRendering,
} from "./render";
import type { LemmaNoteData } from "./types";

/** Data that no valid note holds, such as a pending relation with no Reading. */
export class LemmaNoteSerializeError extends Error {
	override readonly name = "LemmaNoteSerializeError";
}

export type SerializeOptions<L extends Dumling.Language> = {
	readonly projections?: Projections<L>;
};

/**
 * A serialized payload: canonical JSON on one line, `%` written as
 * `\u0025` so no payload can close its Obsidian comment.
 */
function encodePayload(value: unknown): string {
	try {
		return canonicalJson(value).replaceAll("%", "\\u0025");
	} catch (error) {
		throw new LemmaNoteSerializeError(String(error));
	}
}

type Render = {
	readonly links: LinkRenderer;
	readonly labels: Readonly<Record<TypedBlockKind, string>>;
};

function labelled(
	kind: TypedBlockKind,
	content: string | undefined,
	{ labels }: Render,
): string | undefined {
	const clean = content === undefined ? "" : sanitizeRendering(content);
	if (clean.length === 0) return undefined;
	const label = sanitizeRendering(labels[kind]);
	if (label.length === 0) return clean;
	return clean.includes("\n")
		? `*${label}*\n${clean}`
		: `*${label}*: ${clean}`;
}

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

function serializedBlock(
	kind: SerializedBlockKind,
	value: unknown,
	rendering: string | undefined,
): string {
	return typedBlock(kind, encodePayload(value), rendering);
}

/** A serialized Block with its default, labelled rendering. */
function renderedBlock(
	kind: SerializedBlockKind,
	value: unknown,
	render: Render,
): string {
	return serializedBlock(
		kind,
		value,
		labelled(kind, RENDERERS[kind]?.(value, render.links), render),
	);
}

function projectionBlock(
	kind: ProjectionBlockKind,
	rendering: string | undefined,
): string | undefined {
	return rendering === undefined
		? undefined
		: typedBlock(kind, undefined, rendering);
}

const isEmpty = (value: unknown) =>
	value === undefined ||
	value === "" ||
	(Array.isArray(value) && value.length === 0);

/** Freeform and unknown Blocks, which serialization keeps as they are. */
function keptBlocks(blocks: readonly NoteBlock[]): string[] {
	return blocks
		.filter(
			(block) => block.type === "freeform" || block.type === "unknown",
		)
		.map(trimmedRaw)
		.filter((text) => text.length > 0);
}

/**
 * Writes a Lemma note in canonical order (spec: Serialization): the
 * document's preamble, the Lemma part, then a part per Reading Entry and
 * per owned Surface Entry, in data order. Typed Blocks come from `data`;
 * projection Blocks from `options.projections`; the document only
 * contributes its freeform and unknown Blocks, kept byte for byte at the end
 * of the part they were in. Blocks of a part the data no longer has move to
 * the end of the Lemma part, so no user content is lost.
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
		labels: { ...DEFAULT_LABELS, ...projections.labels },
		links: { ...DEFAULT_LINKS, ...projections.links },
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
			attestation: entry.attestations,
			attested_translation: entry.attestedTranslations,
			notes: entry.notes,
			pending_relation:
				pending.length === 0
					? undefined
					: pending.map(({ pending: relation }) => relation),
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
		const projected: Record<ProjectionBlockKind, string | undefined> = {
			header: `${sanitizeRendering((projections.header ?? defaultHeader)(context))} ^${blockId}`,
			inflection: labelled(
				"inflection",
				projections.inflection?.(context),
				render,
			),
			inverse_relation: labelled(
				"inverse_relation",
				(() => {
					const edges = projections.inverseRelations?.(context);
					return edges === undefined || edges.length === 0
						? undefined
						: renderInverseRelations(edges, render.links);
				})(),
				render,
			),
			tags: labelled(
				"tags",
				projections
					.tags?.(context)
					?.map((tag) => `#${tag}`)
					.join(" "),
				render,
			),
		};
		const blocks = CANONICAL_BLOCK_ORDER.reading.map((kind) => {
			if (kind in projected)
				return projectionBlock(
					kind as ProjectionBlockKind,
					projected[kind as ProjectionBlockKind],
				);
			const value = payloads[kind as SerializedBlockKind];
			return isEmpty(value)
				? undefined
				: renderedBlock(kind as SerializedBlockKind, value, render);
		});
		return [
			`%%tf-part:reading ${blockId}%%`,
			...blocks,
			...take("reading", blockId),
		];
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
		const blocks = CANONICAL_BLOCK_ORDER.surface.map((kind) => {
			if (kind === "surface")
				return serializedBlock(
					"surface",
					surface,
					`${labelled("surface", shown, render) ?? ""} ^${blockId}`,
				);
			const value = payloads[kind];
			return isEmpty(value)
				? undefined
				: renderedBlock(kind, value, render);
		});
		return [
			`%%tf-part:surface ${blockId}%%`,
			...blocks,
			...take("surface", blockId),
		];
	});

	const orphans = source.parts
		.filter((part) => !used.has(part))
		.flatMap((part) => keptBlocks(part.blocks));

	const segments = [
		...keptBlocks(source.preamble),
		"%%tf-part:lemma%%",
		serializedBlock("identity", lemma, undefined),
		...lemmaKept,
		...orphans,
		...readingParts.flat(),
		...surfaceParts.flat(),
	].filter((segment): segment is string => segment !== undefined);
	return `${segments.join("\n\n")}\n`;
}
