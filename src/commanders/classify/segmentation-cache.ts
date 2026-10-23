/**
 * The Segmentation Cache (ADR 0014): one immutable JSON entry per Sentence
 * key, holding the Segmented Sentence dumgen returned. It lives in a
 * hidden vault folder outside the Library, read and written through VAM's
 * `hiddenFolder` (`HiddenFolderIo`), which bypasses dispatch and
 * observation, as Obsidian fires no event there. Obsidian Sync skips hidden folders, so each
 * device fills its own; other sync tools may copy entries, which is
 * harmless because an entry is only ever the segmentation of its key.
 *
 * The cache is read once per Sentence a Classify, an unlink check or a
 * reset touches, so its reads and writes open no spans: a large Scroll
 * would push the rest out of the recent trace.
 *
 * Losing an entry costs one re-segmentation, so the cache never fails
 * Classify: an entry that cannot be read or does not decode is a miss, and
 * a write that fails is logged and dropped. Failed segmentations are never
 * stored.
 */
import type { HiddenFolder } from "@textfresser/vault-action-manager";
import type { Route, SegmentedSentence, Unit } from "dumgen";
import { Cause, Context, Effect, Option } from "effect";
import { z } from "zod";

/** The plugin's hidden folder at the vault root. */
export const HIDDEN_FOLDER = ".textfresser";

/** The cache's folder, inside `HIDDEN_FOLDER`. */
export const SEGMENTATION_CACHE_FOLDER = "segmentation";

export class SegmentationCache extends Context.Service<
	SegmentationCache,
	{
		/** The cached Segmented Sentence of a key, if a valid one is stored. */
		get(key: string): Effect.Effect<Option.Option<SegmentedSentence>>;
		/** Stores a successful segmentation under its key. */
		put(key: string, sentence: SegmentedSentence): Effect.Effect<void>;
	}
>()("textfresser/classify/SegmentationCache") {}

/** The part of VAM's `hiddenFolder(HIDDEN_FOLDER)` the cache uses; paths are inside it. */
export type CacheFiles = Pick<
	HiddenFolder,
	"exists" | "mkdir" | "read" | "write"
>;

const RouteSchema = z.object({
	family: z.string(),
	kind: z.string(),
	language: z.literal("de"),
});

const SegmentedSentenceSchema = z.object({
	segments: z.array(
		z.object({
			kind: z.enum([
				"ResolvableText",
				"OpaqueText",
				"Whitespace",
				"Punctuation",
			]),
			surface: z.string().optional(),
			text: z.string(),
		}),
	),
	text: z.string(),
	units: z.array(
		z.object({
			identity: z
				.object({
					canonicalForm: z.string(),
					kind: z.enum(["DET", "PRON"]),
					poss: z.literal("Yes").optional(),
					pronType: z.string().nullable(),
				})
				.optional(),
			route: z.union([z.literal("Unresolved"), RouteSchema]),
			segments: z.array(z.int()),
			variants: z.array(RouteSchema).optional(),
		}),
	),
});

const CacheEntrySchema = z.object({
	format: z.literal(1),
	key: z.string(),
	sentence: SegmentedSentenceSchema,
});

const parseJson = Option.liftThrowable((raw: string): unknown =>
	JSON.parse(raw),
);

/** An entry's JSON, decoded; none when it is not JSON or not an entry. */
function decodeEntry(raw: string): Option.Option<CacheEntry> {
	return Option.flatMap(parseJson(raw), (json) => {
		const parsed = CacheEntrySchema.safeParse(json);
		return parsed.success ? Option.some(parsed.data) : Option.none();
	});
}

type CacheEntry = z.infer<typeof CacheEntrySchema>;

type DecodedSentence = CacheEntry["sentence"];

/**
 * A decoded entry as dumgen's types, once its Segments give its text back
 * and every unit's Segment indices are in range and ascending. A route is
 * kept as stored: only this cache writes entries, from dumgen's own units,
 * and a new dumgen version changes every key.
 */
function segmentedSentenceOf(
	decoded: DecodedSentence,
): SegmentedSentence | undefined {
	if (decoded.segments.map(({ text }) => text).join("") !== decoded.text)
		return;
	const count = decoded.segments.length;
	const units: Unit[] = [];
	for (const unit of decoded.units) {
		const inRange = unit.segments.every(
			(segment, index) =>
				segment >= 0 &&
				segment < count &&
				(index === 0 || segment > (unit.segments[index - 1] ?? -1)),
		);
		if (!inRange || unit.segments.length === 0) return;
		units.push({
			...(unit.identity ? { identity: { ...unit.identity } } : {}),
			route:
				unit.route === "Unresolved"
					? "Unresolved"
					: asRoute(unit.route),
			segments: [...unit.segments],
			...(unit.variants ? { variants: unit.variants.map(asRoute) } : {}),
		});
	}
	return {
		segments: decoded.segments.map((segment) => ({ ...segment })),
		text: decoded.text,
		units,
	};
}

function asRoute(route: z.infer<typeof RouteSchema>): Route {
	// Written by this cache from a dumgen Route under the same segmenter version.
	return { ...route } as Route;
}

/**
 * The entry's path inside `HIDDEN_FOLDER`: keys are spread over 256
 * folders by their first two hex digits.
 */
export function cacheEntryPath(key: string): string {
	return `${SEGMENTATION_CACHE_FOLDER}/${key.slice(0, 2)}/${key}.json`;
}

function folderOf(path: string): string {
	return path.slice(0, path.lastIndexOf("/"));
}

/** Every folder from `HIDDEN_FOLDER` down to `folder`, outermost first. */
function foldersDownTo(folder: string): string[] {
	const parts = folder.split("/");
	return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

/** The cache over the files of VAM's `hiddenFolder(HIDDEN_FOLDER)`. */
export function filesSegmentationCache(
	files: CacheFiles,
): SegmentationCache["Service"] {
	const get = (key: string) =>
		Effect.gen(function* () {
			const path = cacheEntryPath(key);
			if (!(yield* files.exists(path))) return Option.none<string>();
			return Option.some(yield* files.read(path));
		}).pipe(
			Effect.map((read) =>
				Option.flatMap(read, (raw) =>
					Option.flatMap(decodeEntry(raw), (entry) =>
						entry.key === key
							? Option.fromNullishOr(
									segmentedSentenceOf(entry.sentence),
								)
							: Option.none(),
					),
				),
			),
			Effect.catch((error) =>
				Effect.logWarning(
					"[SegmentationCache] Could not read an entry; segmenting again:",
					Cause.fail(error),
				).pipe(Effect.as(Option.none<SegmentedSentence>())),
			),
			Effect.withTracerEnabled(false),
		);
	const put = (key: string, sentence: SegmentedSentence) =>
		Effect.gen(function* () {
			if (sentence.failed) return;
			const path = cacheEntryPath(key);
			for (const folder of foldersDownTo(folderOf(path)))
				if (!(yield* files.exists(folder))) yield* files.mkdir(folder);
			yield* files.write(
				path,
				JSON.stringify({ format: 1, key, sentence }),
			);
		}).pipe(
			Effect.catch((error) =>
				Effect.logWarning(
					"[SegmentationCache] Could not store an entry:",
					Cause.fail(error),
				),
			),
			Effect.withTracerEnabled(false),
		);
	return SegmentationCache.of({ get, put });
}

/** A cache in memory, for tests and for runs that must leave no files. */
export function memorySegmentationCache(): SegmentationCache["Service"] & {
	readonly entries: Map<string, SegmentedSentence>;
} {
	const entries = new Map<string, SegmentedSentence>();
	return {
		entries,
		get: (key) => Effect.sync(() => Option.fromNullishOr(entries.get(key))),
		put: (key, sentence) =>
			Effect.sync(() => {
				if (!sentence.failed) entries.set(key, sentence);
			}),
	};
}
