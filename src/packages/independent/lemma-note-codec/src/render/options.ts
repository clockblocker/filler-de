import type { ReadingEntry } from "dumdict";
import { lemmaIdentityKey, readingIdentityKey } from "dumling";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { Data } from "effect";
import type { BodySegment } from "../boundary";
import type { InflectionHook } from "../inflection";
import {
	DEFAULT_PATHS,
	defaultResolve,
	type LinkRenderer,
	type LinkResolver,
	linkRenderer,
	type NotePaths,
} from "../links";
import type { BreakdownSettled } from "../metadata";
import type { LemmaRecords } from "../types";
import {
	DEFAULT_TITLES,
	type SectionKind,
	type SemanticRelationProjection,
} from "./common";
import type { Formation } from "./formations";

/** What a Reading note's caller-supplied projections read. */
export type ReadingNoteContext<L extends Dumling.Language> = {
	readonly records: LemmaRecords<L>;
	readonly entry: ReadingEntry<L>;
	readonly lemma: Dumling.Lemma<L>;
};

/**
 * The caller-supplied inputs of projections. The codec is pure: it looks
 * nothing up, so a projection whose input is absent is left out, and
 * rendering twice against the same inputs gives the same bytes.
 */
export type RenderOptions<L extends Dumling.Language> = {
	/** The resolution the store holds for each link; {@link defaultResolve} without it. */
	readonly resolve?: LinkResolver<L>;
	/** Where targets live; the path module (ADR-0015) by default. */
	readonly paths?: Partial<NotePaths<L>>;
	/** The Lemma's inflection tables, normally `inflectionFromPack` of a language's Inflection Pack. */
	readonly inflection?: InflectionHook<L>;
	/** A Reading note's tags, without `#`. */
	readonly tags?: (
		context: ReadingNoteContext<L>,
	) => readonly string[] | undefined;
	/**
	 * The inverse relations a Reading note shows, as dumrel's
	 * `projectSemanticRelations` returns them with its Reading as `source`
	 * (#59). Each `target` is the source of a claim on this Reading; it
	 * links by its Lemma's Unit Shadow.
	 */
	readonly inverseRelations?: (
		context: ReadingNoteContext<L>,
	) => readonly SemanticRelationProjection[] | undefined;
	/**
	 * The stored Breakdown and Source of every Reading a Breakdown target
	 * resolves to, which the morphemes line's walk reads (dumrel's
	 * `propagateMorphemes`, ADR 0051). Without it, each part that is no
	 * Morpheme shows as one unsplit chunk.
	 */
	readonly morphemeSources?: Dumrel.LookupMorphemeSources;
	/**
	 * The language's Morpheme Policy for that walk, normally dumcorpus's
	 * `germanMorphemePolicy`. Without it, the walk infers no Ending.
	 */
	readonly morphemePolicy?: Dumrel.MorphemePolicy;
	/**
	 * A Lemma note's Formations (texteater ADR 0050): the stored Readings
	 * whose Constituents or Source link to this Lemma, computed by the
	 * store from its index. Without it, the note lists none.
	 */
	readonly formations?: (
		lemma: Dumling.Lemma<L>,
	) => readonly Formation<L>[] | undefined;
	/** Visible section titles. Cosmetic and never parsed; an empty one leaves its line out. */
	readonly titles?: Partial<Record<SectionKind, string>>;
};

/** A note's previous document, whose freeform serialize keeps. */
export type PreviousDocument = {
	readonly segments: readonly BodySegment[];
};

export type SerializeOptions<L extends Dumling.Language> = RenderOptions<L> & {
	/** The note as parsed before, if it exists: its freeform is kept. */
	readonly previous?: PreviousDocument;
	/**
	 * A Reading note's settled Breakdown marker (#266), written unless its
	 * Knowledge holds a Breakdown or a Source. A Lemma note ignores it.
	 */
	readonly breakdownSettled?: BreakdownSettled;
};

/** A note as serialize writes it: its visible body and the metadata to store. */
export type SerializedNote<M> = {
	readonly body: string;
	readonly metadata: M;
};

/** Data that no valid note holds, such as a Reading of another Lemma. */
export class NoteSerializeError extends Data.TaggedError("NoteSerializeError")<{
	readonly message: string;
}> {}

export type Rendering<L extends Dumling.Language> = {
	readonly link: LinkRenderer<L>;
	readonly paths: NotePaths<L>;
	readonly titles: Readonly<Record<SectionKind, string>>;
};

export function renderingOf<L extends Dumling.Language>(
	options: RenderOptions<L>,
): Rendering<L> {
	const paths = { ...(DEFAULT_PATHS as NotePaths<L>), ...options.paths };
	return {
		link: linkRenderer(options.resolve ?? defaultResolve, paths),
		paths,
		titles: { ...DEFAULT_TITLES, ...options.titles },
	};
}

/**
 * Checks the records a note is rendered from: every Reading, Surface and
 * pending relation is the Lemma's, and none is there twice. Answers the
 * first rule they break, or undefined.
 */
export function checkRecords<L extends Dumling.Language>(
	records: LemmaRecords<L>,
): NoteSerializeError | undefined {
	const lemma = lemmaIdentityKey(records.lemmaRecord.lemma);
	if (
		records.readingEntries.some(
			({ reading }) => lemmaIdentityKey(reading.lemma) !== lemma,
		) ||
		records.ownedSurfaceEntries.some(
			({ ownerLemma }) => lemmaIdentityKey(ownerLemma) !== lemma,
		)
	)
		return new NoteSerializeError({ message: "A record of another Lemma" });
	const readings = records.readingEntries.map(({ reading }) =>
		readingIdentityKey(reading),
	);
	if (new Set(readings).size !== readings.length)
		return new NoteSerializeError({
			message: "Two Reading Entries hold one Reading",
		});
	const surfaces = records.ownedSurfaceEntries.map(({ id }) => id);
	if (new Set(surfaces).size !== surfaces.length)
		return new NoteSerializeError({
			message: "Two Surface Entries hold one Surface",
		});
	if (
		records.pendingRelations.some(
			({ sourceReading }) =>
				!readings.includes(readingIdentityKey(sourceReading)),
		)
	)
		return new NoteSerializeError({
			message: "A pending relation's source Reading is not the Lemma's",
		});
	return undefined;
}
