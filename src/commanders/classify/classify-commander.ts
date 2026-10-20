/**
 * The Classify command over the active editor's selection: it reads the
 * Scroll and the selection's offsets, runs `classifySelection` with the
 * plugin's dumgen, Segmentation Cache and resolver port, and tells the
 * user what it found. It writes nothing to the Scroll; that is the
 * resolver's job (#64).
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
	readonly stats: ClassifyStats;
};

function describeHandoff(
	content: string,
	{ plan, resolutions, stats }: ClassifyOutcome,
): ClassifyHandoff {
	return {
		resolutions: resolutions.map(({ _tag }) => _tag),
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
	const pending = resolutions.filter(({ _tag }) => _tag === "Pending").length;
	const parts = [
		`Classified ${units} unit${units === 1 ? "" : "s"} in ${sentences} Sentence${sentences === 1 ? "" : "s"}`,
	];
	if (stats.failedSentences > 0)
		parts.push(
			`${stats.failedSentences} Sentence${stats.failedSentences === 1 ? "" : "s"} could not be segmented; Classify again to retry`,
		);
	if (pending > 0) parts.push(`${pending} pending resolution`);
	return parts.join("; ");
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
		return classifySelection({
			content: context.content,
			scrollPath: context.scrollPath,
			selection: context.selection ?? { from: 0, to: 0 },
		}).pipe(
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
				Effect.sync(() => {
					notify("⚠ Classify failed unexpectedly");
					logger.error("[Classify] Failed:", Cause.pretty(cause));
				}),
			),
			Effect.asVoid,
		);
	}
}
