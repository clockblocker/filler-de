/**
 * Resolution under test: the real dictionary store over a fake vault, a
 * Scroll held in memory, and a dumgen whose resolve and Knowledge
 * operations are stubs a test scripts per call.
 */
import {
	type DumdictVaultStore,
	makeDumdictVaultStore,
} from "@textfresser/dictionary";
import type { GrammarResolution, ReadingResolution, ResolveGrammarInput, ResolveReadingInput, SegmentedSentence, Unit } from "dumgen";
import { parseUnit } from "dumling";
import type * as Dumling from "dumling/types";
import type * as Dumrel from "dumrel/types";
import { Effect } from "effect";
import { dumgenUnitResolver } from "../../../../src/commanders/classify/resolution/dumgen-unit-resolver";
import { createKnowledgeQueue } from "../../../../src/commanders/classify/resolution/knowledge-queue";
import type { ResolutionStore } from "../../../../src/commanders/classify/resolution/knowledge-types";
import { produceKnowledge } from "../../../../src/commanders/classify/resolution/produce-knowledge";
import {
	type ScrollFiles,
	ScrollWriteFailed,
} from "../../../../src/commanders/classify/resolution/scroll-files";
import type {
	ClassifyPlan,
	PlannedUnit,
} from "../../../../src/commanders/classify/types";
import type { Dumgen } from "../../../../src/managers/dumgen/dumgen-over";
import { FakeVault } from "../../../../src/packages/composed/dictionary/tests/support/fake-vault";

export const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
	Effect.runPromise(effect);

/** Parses a fixture as dumling would, so no test runs on a value dumling refuses. */
export function unit<U extends Dumling.Unit>(value: U): U {
	const parsed = parseUnit(value);
	if (!parsed.success) throw parsed.error;
	return parsed.chain.value as U;
}

type Segment = SegmentedSentence["segments"][number];

/** Segments of a Sentence: words are ResolvableText, single spaces Whitespace. */
function segmentsOf(text: string): Segment[] {
	return (text.match(/\s+|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu) ?? []).map(
		(piece) => ({
			kind: /^\s+$/u.test(piece)
				? "Whitespace"
				: /^[\p{L}\p{N}]+$/u.test(piece)
					? "ResolvableText"
					: "Punctuation",
			text: piece,
		}),
	);
}

/** One planned unit: its Segments in the Sentence starting at `offset` in the Scroll. */
function plannedUnit(input: {
	readonly sentenceKey: string;
	readonly sentence: SegmentedSentence;
	readonly offset: number;
	readonly unit: Unit;
}): PlannedUnit {
	const starts: number[] = [];
	let position = input.offset;
	for (const segment of input.sentence.segments) {
		starts.push(position);
		position += segment.text.length;
	}
	const occurrences: { from: number; to: number }[] = [];
	let previous: number | undefined;
	for (const index of input.unit.segments) {
		const from = starts[index] ?? 0;
		const to = from + (input.sentence.segments[index]?.text.length ?? 0);
		const last = occurrences.at(-1);
		const joined =
			last !== undefined &&
			previous !== undefined &&
			input.sentence.segments
				.slice(previous + 1, index)
				.every(({ kind }) => kind === "Whitespace");
		if (last && joined) last.to = to;
		else occurrences.push({ from, to });
		previous = index;
	}
	return {
		instance: 0,
		occurrences,
		ref: { segments: [...input.unit.segments], sentenceKey: input.sentenceKey },
		unit: input.unit,
	};
}

/**
 * A plan over `content` for the units of one Sentence, found in the content
 * by its text.
 */
export function planFor(input: {
	readonly scrollPath: string;
	readonly content: string;
	readonly sentenceText: string;
	readonly units: readonly Unit[];
	readonly sentenceKey?: string;
}): ClassifyPlan {
	const sentenceKey = input.sentenceKey ?? `key:${input.sentenceText}`;
	const offset = input.content.indexOf(input.sentenceText);
	if (offset < 0) throw new Error(`${input.sentenceText} is not in the Scroll`);
	const sentence: SegmentedSentence = {
		segments: segmentsOf(input.sentenceText),
		text: input.sentenceText,
		units: input.units,
	};
	return {
		content: input.content,
		scrollPath: input.scrollPath,
		sentences: new Map([[sentenceKey, { neighbours: {}, segmented: sentence }]]),
		units: input.units.map((value) =>
			plannedUnit({ offset, sentence, sentenceKey, unit: value }),
		),
	};
}

/** A Scroll held in memory; `beforeWrite` lets a test type into it first. */
export class MemoryScroll implements ScrollFiles {
	readonly writes: string[] = [];
	beforeWrite: ((content: string) => string) | undefined;
	conflictsLeft = 0;

	constructor(
		readonly path: string,
		public content: string,
	) {}

	readonly process: ScrollFiles["process"] = (scrollPath, transform) =>
		Effect.suspend(() => {
			if (scrollPath !== this.path)
				return Effect.fail(
					new ScrollWriteFailed({
						cause: scrollPath,
						conflict: false,
						message: `No Scroll at ${scrollPath}`,
					}),
				);
			if (this.beforeWrite) {
				this.content = this.beforeWrite(this.content);
				this.beforeWrite = undefined;
			}
			if (this.conflictsLeft > 0) {
				this.conflictsLeft--;
				return Effect.fail(
					new ScrollWriteFailed({
						cause: "race",
						conflict: true,
						message: "lost a race",
					}),
				);
			}
			this.content = transform(this.content);
			this.writes.push(this.content);
			return Effect.void;
		});
}

type GrammarStub = (input: ResolveGrammarInput) => GrammarResolution;
type ReadingStub = (
	input: ResolveReadingInput,
) => ReadingResolution | Promise<ReadingResolution>;
type KnowledgeStub = (
	input: Parameters<Dumgen["knowledge"]["produce"]>[0],
) => {
	readonly changes: readonly Dumrel.KnowledgeChange<Dumling.Reading<"de">>[];
	readonly pendingRelations?: readonly (Dumrel.PendingSemanticRelation & {
		readonly target: { readonly language: "de" };
	})[];
	readonly paradigmChanges?: readonly Dumrel.ParadigmChange[];
};

/**
 * A dumgen whose resolve and Knowledge operations answer from stubs and
 * record their inputs; segmentation and translation are never called.
 */
export function stubDumgen(stubs: {
	grammar: GrammarStub;
	reading: ReadingStub;
	knowledge?: KnowledgeStub;
}) {
	const calls = {
		grammar: [] as ResolveGrammarInput[],
		knowledge: [] as Parameters<Dumgen["knowledge"]["produce"]>[0][],
		reading: [] as ResolveReadingInput[],
	};
	const unused = () => Effect.die(new Error("not stubbed"));
	const dumgen: Dumgen = {
		knowledge: {
			accumulateTranslations: unused,
			produce: (input) =>
				Effect.gen(function* () {
					calls.knowledge.push(input);
					const stub: KnowledgeStub = stubs.knowledge ?? (() => ({ changes: [] }));
					const produced = stub(input);
					for (const change of produced.changes)
						yield* input.onContribution?.([change]) ?? Effect.void;
					return {
						changes: produced.changes,
						failures: [],
						paradigmChanges: produced.paradigmChanges ?? [],
						pendingRelations: produced.pendingRelations ?? [],
					};
				}),
		},
		language: { detect: unused },
		resolve: {
			grammar: (input) =>
				Effect.sync(() => {
					calls.grammar.push(input);
					return stubs.grammar(input);
				}),
			reading: (input) =>
				Effect.promise(async () => {
					calls.reading.push(input);
					return stubs.reading(input);
				}),
		},
		segment: { inUnits: unused },
		translate: { sentence: unused },
	};
	return { calls, dumgen };
}

/** The base text a stub produces for whatever its request asks. */
export const baseTextKnowledge: KnowledgeStub = (input) => {
	const changes: Dumrel.KnowledgeChange<Dumling.Reading<"de">>[] = [];
	const request = input.request;
	if (request.transcription === null)
		changes.push({ aspect: "transcription", kind: "Contribute", value: "zeː" });
	if (request.definition === null)
		changes.push({
			aspect: "definition",
			kind: "Contribute",
			value: `${input.reading.lemma.canonicalForm}, defined`,
		});
	for (const language of Object.keys(request.translations ?? {}))
		changes.push({
			aspect: "translations",
			kind: "Contribute",
			language: language as "en",
			value: [`${input.reading.lemma.canonicalForm} (${language})`],
		});
	return { changes };
};

export async function resolutionHarness(options: {
	readonly scrollPath: string;
	readonly content: string;
	readonly dumgen: Dumgen;
	readonly vault?: FakeVault;
	/** Wraps the store the resolver commits through, to inject races. */
	readonly wrapStore?: (store: DumdictVaultStore) => ResolutionStore;
	/** Whether Knowledge production asks for the Lemma Paradigm. */
	readonly produceParadigm?: boolean;
}) {
	const vault = options.vault ?? new FakeVault();
	// Obsidian knows the Scroll, so refs name it as the store resolves it.
	if (vault.content(options.scrollPath) === undefined)
		vault.silentWrite(options.scrollPath, options.content);
	const store = await run(makeDumdictVaultStore({ vault }));
	const resolverStore = options.wrapStore?.(store) ?? store;
	const scroll = new MemoryScroll(options.scrollPath, options.content);
	const notices: string[] = [];
	const queue = createKnowledgeQueue({
		notify: (message) => notices.push(message),
		run: (job) =>
			produceKnowledge(
				{
					dumgen: options.dumgen,
					store: resolverStore,
					translationLanguages: ["en"],
					...(options.produceParadigm === undefined
						? {}
						: { produceParadigm: options.produceParadigm }),
				},
				job,
			),
	});
	const resolver = dumgenUnitResolver({
		dumgen: Effect.succeed(options.dumgen),
		knowledge: queue,
		notify: (message) => notices.push(message),
		scroll,
		store: Effect.succeed(resolverStore),
	});
	return {
		notices,
		queue,
		resolve: async (plan: ClassifyPlan) => {
			const resolutions = await run(resolver.resolve(plan));
			await queue.whenIdle();
			return resolutions;
		},
		scroll,
		store,
		vault,
	};
}

/** A German Attestation of `lemma` by `members`, all Standard spellings. */
export function attestationOf(
	lemma: Dumling.Lemma<"de">,
	normalizedSurface: string,
	members: readonly string[],
	/** The route's evidence fields, such as a noun's `articleEvidence`. */
	evidence: Readonly<Record<string, unknown>> = {},
): Dumling.Attestation<"de"> {
	const surface = {
		inflectionalFeatures: null,
		language: "de",
		lemma,
		normalizedSurface,
		spelling: { kind: "Canonical" },
		surfaceFeatures: null,
		unitKind: "Surface",
	};
	return unit({
		members: members.map((attested) => ({
			attested,
			orthography: "Standard",
		})),
		realizationCoverage: "Full",
		surface,
		...evidence,
		unitKind: "Attestation",
	} as unknown as Dumling.Attestation<"de">);
}

/**
 * How Obsidian resolves a link's path, ignoring case: the note at that path,
 * with or without `.md`, else, for a bare name, the note of that name.
 */
export const resolveAmong =
	(paths: () => readonly string[]) => (linkpath: string) =>
		Effect.sync(() => {
			const wanted = linkpath.toLowerCase();
			const all = paths();
			const exact = all.find(
				(path) =>
					path.toLowerCase() === wanted || path.toLowerCase() === `${wanted}.md`,
			);
			if (exact !== undefined || wanted.includes("/")) return exact;
			return all.find(
				(path) => path.toLowerCase().split("/").at(-1) === `${wanted}.md`,
			);
		});
