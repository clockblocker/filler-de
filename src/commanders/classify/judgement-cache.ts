/**
 * The Judgement Cache (#281): per occurrence, what dumgen judged its unit,
 * so a later click on its link can attest it without asking again. An
 * entry holds the unit's Attestation, the Reading it commits under and the
 * Sentence target its Knowledge is asked for.
 *
 * It lives beside the Segmentation Cache in the plugin's hidden folder,
 * read and written through VAM's `hiddenFolder` (`CacheFiles`), and opens
 * no spans for the same reason. An occurrence is named by its Sentence's
 * Segmentation Cache key and its occurrence key (`KeyedOccurrence`), as a
 * ref's alias alone is too short to name one across the vault. Obsidian
 * Sync skips hidden folders, so each device fills its own.
 *
 * Unlike a segmentation, a judgement can go stale: the Reading it names
 * may since have been removed or replaced. An entry is therefore
 * overwritten whenever its occurrence is judged again, and the caller
 * decides what a stale one is worth.
 *
 * Losing an entry costs one judgement, so the cache never fails its
 * caller: an entry that cannot be read or does not decode is a miss, and a
 * write that fails is logged and dropped.
 */
import { parseUnit } from "dumling";
import type * as Dumling from "dumling/types";
import { Cause, Context, Effect, Option } from "effect";
import { z } from "zod";
import type { KeyedOccurrence } from "./resolution/occurrence-keys";
import type { CacheFiles } from "./segmentation-cache";

/** The cache's folder, inside `HIDDEN_FOLDER`. */
export const JUDGEMENT_CACHE_FOLDER = "judgements";

/** One occurrence, as the cache names it. */
export type JudgedOccurrence = Pick<
	KeyedOccurrence,
	"occurrence" | "sentenceKey"
>;

/** What dumgen judged one occurrence's unit. */
export type Judgement = {
	readonly attestation: Dumling.Attestation<"de">;
	readonly reading: Dumling.Reading<"de">;
	/** Its Sentence's Segments and the unit's among them, as its Knowledge is asked for. */
	readonly sentence: {
		readonly segments: readonly { readonly text: string }[];
		readonly target: readonly number[];
	};
};

export class JudgementCache extends Context.Service<
	JudgementCache,
	{
		/** The judgement stored for an occurrence, if a valid one is. */
		get(at: JudgedOccurrence): Effect.Effect<Option.Option<Judgement>>;
		/** Stores an occurrence's judgement, in place of any before it. */
		put(at: JudgedOccurrence, judgement: Judgement): Effect.Effect<void>;
	}
>()("textfresser/classify/JudgementCache") {}

const SentenceTargetSchema = z
	.object({
		segments: z.array(z.object({ text: z.string() })),
		target: z.array(z.int().nonnegative()).min(1),
	})
	.refine(({ segments, target }) =>
		target.every(
			(segment, index) =>
				segment < segments.length &&
				(index === 0 || segment > (target[index - 1] ?? -1)),
		),
	);

const CacheEntrySchema = z.object({
	attestation: z.unknown(),
	format: z.literal(1),
	occurrence: z.string(),
	reading: z.unknown(),
	sentence: SentenceTargetSchema,
	sentenceKey: z.string(),
});

const parseJson = Option.liftThrowable((raw: string): unknown =>
	JSON.parse(raw),
);

/** A German unit of `unitKind` that dumling accepts, as dumling normalized it. */
function germanUnitOf<K extends "Attestation" | "Reading">(
	value: unknown,
	unitKind: K,
): Option.Option<Dumling.Unit<K, "de">> {
	const parsed = parseUnit(value);
	return parsed.success &&
		parsed.chain.unitKind === unitKind &&
		parsed.chain.language === "de"
		? // Narrowed by its unit kind and language just above.
			Option.some(parsed.chain.value as Dumling.Unit<K, "de">)
		: Option.none();
}

/** An entry's JSON as the judgement of `at`; none when it is not one. */
function decodeEntry(
	raw: string,
	at: JudgedOccurrence,
): Option.Option<Judgement> {
	return Option.flatMap(parseJson(raw), (json) => {
		const parsed = CacheEntrySchema.safeParse(json);
		if (
			!parsed.success ||
			parsed.data.sentenceKey !== at.sentenceKey ||
			parsed.data.occurrence !== at.occurrence
		)
			return Option.none();
		const { sentence } = parsed.data;
		return Option.flatMap(
			germanUnitOf(parsed.data.attestation, "Attestation"),
			(attestation) =>
				Option.map(
					germanUnitOf(parsed.data.reading, "Reading"),
					(reading) => ({ attestation, reading, sentence }),
				),
		);
	});
}

/** Whether `at` names an occurrence as Classify keys one: hex digits only. */
const isKeyed = (at: JudgedOccurrence) =>
	/^[0-9a-f]{64}$/u.test(at.sentenceKey) &&
	/^[0-9a-f]{8}$/u.test(at.occurrence);

/**
 * The entry's path inside `HIDDEN_FOLDER`: spread over 256 folders by its
 * Sentence key's first two hex digits, as the Segmentation Cache is.
 */
export function judgementEntryPath(at: JudgedOccurrence): string {
	return `${JUDGEMENT_CACHE_FOLDER}/${at.sentenceKey.slice(0, 2)}/${at.sentenceKey}-${at.occurrence}.json`;
}

/** Every folder from `HIDDEN_FOLDER` down to `path`'s, outermost first. */
function foldersAbove(path: string): string[] {
	const parts = path.split("/").slice(0, -1);
	return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

/** The cache over the files of VAM's `hiddenFolder(HIDDEN_FOLDER)`. */
export function filesJudgementCache(
	files: CacheFiles,
): JudgementCache["Service"] {
	const get = (at: JudgedOccurrence) =>
		Effect.gen(function* () {
			const path = judgementEntryPath(at);
			if (!isKeyed(at) || !(yield* files.exists(path)))
				return Option.none<string>();
			return Option.some(yield* files.read(path));
		}).pipe(
			Effect.map((read) =>
				Option.flatMap(read, (raw) => decodeEntry(raw, at)),
			),
			Effect.catch((error) =>
				Effect.logWarning(
					"[JudgementCache] Could not read an entry; judging again:",
					Cause.fail(error),
				).pipe(Effect.as(Option.none<Judgement>())),
			),
			Effect.withTracerEnabled(false),
		);
	const put = (at: JudgedOccurrence, judgement: Judgement) =>
		Effect.gen(function* () {
			if (!isKeyed(at)) return;
			const path = judgementEntryPath(at);
			for (const folder of foldersAbove(path))
				if (!(yield* files.exists(folder))) yield* files.mkdir(folder);
			yield* files.write(
				path,
				JSON.stringify({
					attestation: judgement.attestation,
					format: 1,
					occurrence: at.occurrence,
					reading: judgement.reading,
					sentence: judgement.sentence,
					sentenceKey: at.sentenceKey,
				}),
			);
		}).pipe(
			Effect.catch((error) =>
				Effect.logWarning(
					"[JudgementCache] Could not store an entry:",
					Cause.fail(error),
				),
			),
			Effect.withTracerEnabled(false),
		);
	return JudgementCache.of({ get, put });
}

/** A cache in memory, for tests and for runs that must leave no files. */
export function memoryJudgementCache(): JudgementCache["Service"] & {
	readonly entries: Map<string, Judgement>;
} {
	const entries = new Map<string, Judgement>();
	return {
		entries,
		get: (at) =>
			Effect.sync(() =>
				Option.fromNullishOr(entries.get(judgementEntryPath(at))),
			),
		put: (at, judgement) =>
			Effect.sync(() => {
				entries.set(judgementEntryPath(at), judgement);
			}),
	};
}
