/**
 * The stage boundary between Classify's two stages (#74): segmentation
 * hands resolution a `ClassifyPlan` of `UnitRef`s. In piped mode the plan
 * never touches disk; only the Segmented Sentences it points at are cached
 * (ADR 0014).
 */
import type { ResolveGrammarInput, SegmentedSentence, Unit } from "dumgen";
import type { UserLinks } from "./resolution/scroll-links";

/**
 * One dumgen unit of one Sentence: the Sentence's cache key (ADR 0014,
 * `sentenceKey`) and the unit's Segment indices, ascending, discontinuous
 * pieces included. Its Family and Kind are on the unit's `route`.
 */
export type UnitRef = {
	readonly sentenceKey: string;
	readonly segments: readonly number[];
};

/** A half-open range of editor offsets in the Scroll as Classify read it. */
export type SourceRange = {
	readonly from: number;
	readonly to: number;
};

/** The Sentences around a Sentence, as dumgen's resolution reads them. */
export type NeighbourSentences = ResolveGrammarInput["neighbours"];

/** A segmented Sentence with what resolution reads alongside it. */
export type PlannedSentence = {
	readonly segmented: SegmentedSentence;
	readonly neighbours: NeighbourSentences;
};

/**
 * A unit the selection covers: its ref, dumgen's unit with its route, and
 * where each of its pieces stands in the Scroll. A piece is a run of the
 * unit's Segments with only whitespace between them, so `fängt … an` has
 * two occurrences that link to the same Reading (batteries ADR 0035).
 */
export type PlannedUnit = {
	readonly ref: UnitRef;
	/**
	 * Which instance of its Sentence's text in the Scroll the unit stands
	 * in, counted from 0 in reading order (`sentenceInstances`). A Sentence
	 * repeated in one Scroll, such as a refrain, has one `UnitRef` but a
	 * separate unit per instance, each its own occurrence.
	 */
	readonly instance: number;
	readonly unit: Unit;
	readonly occurrences: readonly SourceRange[];
};

/**
 * Everything resolution needs: per Sentence key, the `(SegmentedSentence,
 * NeighbourSentences)` dumgen's `ResolveGrammarInput` and
 * `ResolveReadingInput` take, and the units in reading order.
 */
export type ClassifyPlan = {
	readonly scrollPath: string;
	/**
	 * The Scroll's content as Classify read it: the occurrences' offsets
	 * index it, and resolution maps them onto the Scroll as it is when it
	 * writes.
	 */
	readonly content: string;
	readonly sentences: ReadonlyMap<string, PlannedSentence>;
	/** The covered units, one per instance of a repeated Sentence, in reading order. */
	readonly units: readonly PlannedUnit[];
	/**
	 * Whether links the user wrote at an occurrence are kept or replaced by
	 * the link to its Reading. The command keeps them; the Dictionary reset
	 * replaces the old notes' links (#148). `Keep` when absent.
	 */
	readonly userLinks?: UserLinks;
	/** When the plan's occurrences become Attestations (#281); `OnClick` when absent. */
	readonly attest?: AttestMode;
	/**
	 * For `Clicked`: the Reading note the clicked link opens. While its
	 * Reading is stored, the occurrence is attested to it, never judged
	 * another.
	 */
	readonly clickedReading?: string;
};

/**
 * When Classify attests an occurrence it links (#281):
 *
 * - `OnClick`: the command. It links and commits, but an occurrence gets
 *   its Attestation Ref only once the user clicks its link; one already
 *   attested keeps its ref. Each judgement is cached for the click.
 * - `Now`: the dictionary reset, whose old notes were attested. Every
 *   occurrence is attested as it is linked, its block cut and minted.
 * - `Clicked`: the click on one occurrence's link. It is attested from its
 *   cached judgement, judged again only on a miss; its Knowledge was asked
 *   for when it was linked.
 */
export type AttestMode = "OnClick" | "Now" | "Clicked";
