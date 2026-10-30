/**
 * A Reading's Breakdown in its Knowledge run (#266; texteater ADR 0050, ADR
 * 0051, dumgen ADR 0007), ported from tf-demo's `knowledgeBreakdown.ts`.
 * The run asks `knowledge.produce` for the Source first. A Reading with a
 * Source runs neither segmenter, and one whose `source` failed or is
 * Unresolved holds both. A Source that points back at a word whose own
 * stored Source names this one counts as none (texteater #1279): it is
 * dropped, and the segmenters run. Any other runs `segment.inConstituents`,
 * and a single-word Lexeme it finds none for is a bottom word, which
 * `segment.inMorphemes` splits.
 *
 * Each piece is stored as the segmenter returns it, a Lemma or a Unit
 * Shadow, so nothing is generated for a part the learner hasn't met. A
 * failed segmenter is a failure of its part, never the run's error: the
 * rest of the Knowledge is still published, and the next Classify of the
 * Reading asks again (`breakdownAskFor`). A step that finished with nothing
 * to store, and nothing failed, settles the Reading instead: its segmenters
 * found no parts, or its Source came back Unresolved. dumrel stores no
 * "asked, nothing", so the run records it in the Reading note
 * (`breakdownSettled`), and later occurrences ask no more.
 */

import {
	namesLemma,
	pointsBack,
	type StoredBase,
} from "@textfresser/dictionary";
import type { BreakdownSettled } from "@textfresser/lemma-note-codec";
import type { Jev } from "dumgen";
import type * as Dumling from "dumling/types";
import { parseReadingKnowledge } from "dumrel";
import type * as Dumrel from "dumrel/types";
import { Effect, Predicate } from "effect";
import type { DumgenOperations } from "../../../managers/dumgen";
import type { GermanKnowledgeChange, ResolutionStore } from "./knowledge-types";

type Segment = DumgenOperations["segment"];

/** What `segment.inConstituents` answers, as the operation types it. */
type Constituents = Effect.Success<ReturnType<Segment["inConstituents"]>>;

/** One produced piece: shown letters and, unless filler, its target. */
type ProducedPiece = Effect.Success<ReturnType<Segment["inMorphemes"]>>[number];

type BreakdownPart = "constituents" | "morphemes";

/** A segmenter that produced nothing usable, as a run's aspect failure. */
export type BreakdownFailure = {
	readonly aspect: "breakdown";
	readonly leaf: BreakdownPart;
	readonly code: "ProviderFailure" | "InvalidModelOutput";
	readonly message: string;
};

/** What `knowledge.produce` answered, as far as the Breakdown reads it. */
export type ProducedKnowledge = {
	readonly changes: readonly GermanKnowledgeChange[];
	readonly failures: readonly {
		readonly aspect: string;
		readonly code: string;
	}[];
};

/** The Breakdown a run adds to what `knowledge.produce` answered. */
export type BrokenDown = {
	/** The produced changes, less a Source dropped for pointing back, plus the Breakdown's. */
	readonly changes: readonly GermanKnowledgeChange[];
	readonly failures: readonly BreakdownFailure[];
	/** Why the Reading is asked no more, when the step stored nothing and nothing failed. */
	readonly settled?: BreakdownSettled;
};

type Produced = {
	readonly changes: readonly GermanKnowledgeChange[];
	readonly failures: readonly BreakdownFailure[];
};

const NOTHING: Produced = { changes: [], failures: [] };

const failed = (
	part: BreakdownPart,
	code: BreakdownFailure["code"],
	message: string,
): Produced => ({
	changes: [],
	failures: [{ aspect: "breakdown", code, leaf: part, message }],
});

/**
 * One half of the Breakdown as a change, once dumrel accepts it for the
 * Reading: its letters spell the Canonical Form back and its targets fit
 * (ADR 0050). A rejected split is an unusable answer, so the rest of the
 * run still publishes.
 */
function contributed(
	reading: Dumling.Reading<"de">,
	part: BreakdownPart,
	pieces: readonly ProducedPiece[],
): Produced {
	const value = pieces.map(({ letters, target }) =>
		target ? { letters, target } : { letters },
	);
	const checked = parseReadingKnowledge({
		knowledge: { breakdown: { [part]: value } },
		source: reading,
	});
	if (!checked.success)
		return failed(part, "InvalidModelOutput", checked.error.message);
	const pieced = checked.value.breakdown?.[part];
	if (pieced === undefined)
		return failed(part, "InvalidModelOutput", `No ${part} came back`);
	return {
		changes: [
			{ aspect: "breakdown", kind: "Contribute", part, value: pieced },
		],
		failures: [],
	};
}

/** A bottom word's morphemes are split only on a single-word Lexeme. */
const isSingleWordLexeme = (lemma: Dumling.Lemma<"de">) =>
	lemma.family === "Lexeme" && !/\s/u.test(lemma.canonicalForm);

/** A link target: a Lemma carries its `unitKind`, a Unit Shadow none. */
type LinkTarget = Dumrel.UnitShadow | Dumling.Lemma<"de">;

/** The target a Source-setting change links to; a Retract has none. */
export function sourceTargetOf(
	change: GermanKnowledgeChange,
): LinkTarget | undefined {
	if (change.aspect !== "source" || change.kind === "Retract")
		return undefined;
	const { target } = change.value;
	return Predicate.isObject(target) ? (target as LinkTarget) : undefined;
}

/** The stored Lemmas a Source's target may name, with their Readings, from one view. */
export function storedBasesOf(
	view: {
		readonly lemmaCandidates: (
			texts: readonly string[],
		) => readonly { readonly lemma: Dumling.Lemma<"de"> }[];
		readonly lemmaNote: (
			lemma: Dumling.Lemma<"de">,
		) => { readonly readings: StoredBase["readings"] } | undefined;
	},
	target: LinkTarget,
): StoredBase[] {
	return view
		.lemmaCandidates([target.canonicalForm])
		.filter(({ lemma }) => namesLemma(target, lemma))
		.map(({ lemma }) => ({
			lemma,
			readings: view.lemmaNote(lemma)?.readings ?? [],
		}));
}

/** {@link storedBasesOf}, read through the store. */
const loadStoredBases = Effect.fnUntraced(function* (
	store: Pick<ResolutionStore, "lemmaCandidates" | "lemmaNote">,
	target: LinkTarget,
): Effect.fn.Return<StoredBase[]> {
	const candidates = yield* store.lemmaCandidates([target.canonicalForm]);
	const bases: StoredBase[] = [];
	for (const { lemma } of candidates) {
		if (!namesLemma(target, lemma)) continue;
		const note = yield* store.lemmaNote(lemma);
		bases.push({ lemma, readings: note?.readings ?? [] });
	}
	return bases;
});

/**
 * The Breakdown changes and failures for a Reading the run found no Source
 * for. A failed call is a failure of its part, never the run's error.
 */
const segmented = Effect.fnUntraced(function* (
	segment: Pick<Segment, "inConstituents" | "inMorphemes">,
	input: {
		readonly reading: Dumling.Reading<"de">;
		readonly sentence?: string;
	},
): Effect.fn.Return<Produced, never, Jev> {
	const asFailure =
		(part: BreakdownPart) =>
		(error: { readonly _tag: BreakdownFailure["code"]; message: string }) =>
			Effect.succeed(failed(part, error._tag, error.message));
	return yield* segment.inConstituents(input).pipe(
		Effect.flatMap((constituents: Constituents) => {
			if (constituents.kind === "Constituents")
				return Effect.succeed(
					contributed(
						input.reading,
						"constituents",
						constituents.pieces,
					),
				);
			if (!isSingleWordLexeme(input.reading.lemma))
				return Effect.succeed(NOTHING);
			return segment.inMorphemes(input).pipe(
				Effect.map((pieces) =>
					contributed(input.reading, "morphemes", pieces),
				),
				Effect.catch(asFailure("morphemes")),
			);
		}),
		Effect.catch(asFailure("constituents")),
	);
});

/**
 * What `knowledge.produce` answered with the Reading's Breakdown added,
 * when what it answered for the Source leaves the segmenters to run. A
 * Source that points back is dropped from the changes.
 */
export const breakDownReading = Effect.fn("classify.breakDownReading")(
	function* (
		deps: {
			readonly segment: Pick<Segment, "inConstituents" | "inMorphemes">;
			readonly store: Pick<
				ResolutionStore,
				"lemmaCandidates" | "lemmaNote"
			>;
		},
		input: {
			readonly reading: Dumling.Reading<"de">;
			readonly sentence?: string;
			readonly produced: ProducedKnowledge;
		},
	): Effect.fn.Return<BrokenDown, never, Jev> {
		const { produced, reading } = input;
		const unchanged: BrokenDown = {
			changes: produced.changes,
			failures: [],
		};
		// A failed or Unresolved Source holds both segmenters; an Unresolved
		// answer, unlike a failed call, settles the Reading.
		const sourceFailures = produced.failures.filter(
			({ aspect }) => aspect === "source",
		);
		if (sourceFailures.length > 0)
			return sourceFailures.every(({ code }) => code === "Unresolved")
				? { ...unchanged, settled: "Unresolved" }
				: unchanged;
		const source = produced.changes.find(
			(change) => sourceTargetOf(change) !== undefined,
		);
		const target =
			source === undefined ? undefined : sourceTargetOf(source);
		if (target !== undefined) {
			const bases = yield* loadStoredBases(deps.store, target);
			if (!pointsBack(reading.lemma, target, bases)) return unchanged;
			yield* Effect.logWarning("BackPointingSourceRejected").pipe(
				Effect.annotateLogs({
					base: target.canonicalForm,
					owner: reading.lemma.canonicalForm,
				}),
			);
		}
		const kept = produced.changes.filter((change) => change !== source);
		const breakdown = yield* segmented(deps.segment, {
			reading,
			...(input.sentence === undefined
				? {}
				: { sentence: input.sentence }),
		});
		return {
			changes: [...kept, ...breakdown.changes],
			failures: breakdown.failures,
			...(breakdown.changes.length === 0 &&
			breakdown.failures.length === 0
				? { settled: "NoParts" as const }
				: {}),
		};
	},
);
