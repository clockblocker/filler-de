/**
 * The Classify command over the active editor's selection: it reads the
 * Scroll and the selection's offsets, runs `classifySelection` with the
 * plugin's dumgen, Segmentation Cache and resolver port, and tells the
 * user what it found. The resolver commits each unit's Reading and links
 * its Segments (#64); this command writes nothing itself.
 */
import type { Dumgen } from "dumgen";
import { Cause, Effect, Layer } from "effect";
import { getErrorMessage } from "../../utils/get-error-message";
import { logger } from "../../utils/logger";
import {
	ClassifyError,
	type ClassifyOutcome,
	ClassifySegmenter,
	type ClassifyStats,
	classifySelection,
} from "./classify-selection";
import { SegmentationCache } from "./segmentation-cache";
import type { SourceRange, UnitRef } from "./types";
import { UnitResolver } from "./unit-resolver";

export type ClassifyCommanderDeps = {
	/** The plugin's dumgen; it throws once the plugin has unloaded. */
	readonly dumgen: () => Dumgen;
	readonly segmenterVersion: () => string;
	readonly cache: SegmentationCache["Service"];
	readonly resolver: UnitResolver["Service"];
	/**
	 * The provider keys Classify lacks, by provider name (`TypeSafe`,
	 * `OpenAI`); Classify asks nothing without them.
	 */
	readonly missingProviderKeys?: () => readonly string[];
	/**
	 * Why Classify may not run now on the Scroll at `scrollPath`, such as a
	 * dictionary reset moving `Worter/` or a protected Scroll; Classify then
	 * tells the user and writes nothing.
	 */
	readonly blockedBy?: (scrollPath: string) => string | undefined;
};

export type ClassifyContext = {
	readonly scrollPath: string;
	readonly content: string;
	readonly selection: SourceRange | null;
};

/**
 * A JSON view of the hand-off to the resolver port, with each
 * occurrence's text: what desktop E2E asserts through the driver's status.
 */
export type ClassifyHandoff = {
	readonly scrollPath: string;
	readonly sentences: readonly {
		readonly sentenceKey: string;
		readonly text: string;
	}[];
	readonly units: readonly {
		readonly ref: UnitRef;
		readonly family: string;
		readonly kind: string;
		readonly occurrences: readonly (SourceRange & {
			readonly text: string;
		})[];
	}[];
	readonly resolutions: readonly string[];
	/** Per unit, the Reading block it now links to, or why it is pending. */
	readonly resolved: readonly (
		| {
				readonly readingPath: string;
				readonly linked: number;
		  }
		| { readonly pending: string }
	)[];
	readonly stats: ClassifyStats;
};

function describeHandoff(
	content: string,
	{ plan, resolutions, stats }: ClassifyOutcome,
): ClassifyHandoff {
	return {
		resolutions: resolutions.map(({ _tag }) => _tag),
		resolved: resolutions.map((resolution) =>
			resolution._tag === "Resolved"
				? {
						linked: resolution.linked,
						readingPath: resolution.readingPath,
					}
				: { pending: resolution.reason },
		),
		scrollPath: plan.scrollPath,
		sentences: [...plan.sentences].map(([sentenceKey, { segmented }]) => ({
			sentenceKey,
			text: segmented.text,
		})),
		stats,
		units: plan.units.map(({ occurrences, ref, unit }) => ({
			family:
				unit.route === "Unresolved" ? "Unresolved" : unit.route.family,
			kind: unit.route === "Unresolved" ? "Unresolved" : unit.route.kind,
			occurrences: occurrences.map((range) => ({
				...range,
				text: content.slice(range.from, range.to),
			})),
			ref,
		})),
	};
}

function summary({ plan, resolutions, stats }: ClassifyOutcome): string {
	const units = plan.units.length;
	const sentences = plan.sentences.size;
	const plural = (count: number, noun: string) =>
		`${count} ${noun}${count === 1 ? "" : "s"}`;
	const resolved = resolutions.filter(({ _tag }) => _tag === "Resolved");
	const pending = resolutions.flatMap((resolution) =>
		resolution._tag === "Pending" ? [resolution.reason] : [],
	);
	const parts = [
		resolved.length > 0
			? `Linked ${plural(resolved.length, "unit")} of ${units} in ${plural(sentences, "Sentence")}`
			: `Classified ${plural(units, "unit")} in ${plural(sentences, "Sentence")}`,
	];
	if (stats.failedSentences > 0)
		parts.push(
			`${plural(stats.failedSentences, "Sentence")} could not be segmented; Classify again to retry`,
		);
	if (pending.length > 0)
		parts.push(
			`${pending.length} pending resolution (${[...new Set(pending)].slice(0, 3).join("; ")})`,
		);
	return parts.join("; ");
}

/** The notice for missing provider keys, or undefined when both are set. */
export function missingKeysNotice(
	missing: readonly string[],
): string | undefined {
	if (missing.length === 0) return undefined;
	const names = missing.join(" and ");
	const one = /^[AEIOU]/u.test(names)
		? `an ${names} API key`
		: `a ${names} API key`;
	return `⚠ Classify needs ${missing.length === 1 ? one : `${names} API keys`}. Add ${missing.length === 1 ? "it" : "them"} in Textfresser's settings.`;
}

export class ClassifyCommander {
	private latest: ClassifyHandoff | null = null;

	constructor(private readonly deps: ClassifyCommanderDeps) {}

	/** What the last successful Classify handed to the resolver; desktop E2E reads it. */
	latestHandoff(): ClassifyHandoff | null {
		return this.latest;
	}

	execute(
		context: ClassifyContext,
		notify: (message: string) => void,
	): Effect.Effect<void> {
		const { cache, dumgen, resolver, segmenterVersion } = this.deps;
		const layer = Layer.mergeAll(
			Layer.succeed(SegmentationCache, cache),
			Layer.succeed(UnitResolver, resolver),
			Layer.succeed(ClassifySegmenter, {
				dumgen: Effect.try({
					catch: (cause) =>
						new ClassifyError({
							message: `dumgen is unavailable: ${getErrorMessage(cause)}`,
							reason: "DumgenUnavailable",
						}),
					try: dumgen,
				}),
				segmenterVersion: segmenterVersion(),
			}),
		);
		const blocked = this.deps.blockedBy?.(context.scrollPath);
		const missing =
			blocked === undefined
				? missingKeysNotice(this.deps.missingProviderKeys?.() ?? [])
				: `⚠ ${blocked}`;
		if (missing)
			return Effect.sync(() => {
				this.latest = null;
				notify(missing);
			});
		return Effect.sync(() => {
			this.latest = null;
		}).pipe(
			Effect.andThen(
				classifySelection({
					content: context.content,
					scrollPath: context.scrollPath,
					selection: context.selection ?? { from: 0, to: 0 },
				}),
			),
			Effect.provide(layer),
			Effect.tap((outcome) =>
				Effect.sync(() => {
					this.latest = describeHandoff(context.content, outcome);
					notify(summary(outcome));
				}),
			),
			Effect.catchTag("ClassifyError", (error) =>
				Effect.sync(() => {
					notify(`⚠ ${error.message}`);
					logger.warn(`[Classify] ${error.reason}: ${error.message}`);
				}),
			),
			Effect.catchCause((cause) =>
				Cause.hasInterruptsOnly(cause)
					? Effect.failCause(cause)
					: Effect.sync(() => {
							notify("⚠ Classify failed unexpectedly");
							logger.error(
								"[Classify] Failed:",
								Cause.pretty(cause),
							);
						}),
			),
			Effect.asVoid,
		);
	}
}
