/**
 * The Segmentation Cache (ADR 0014): one immutable JSON entry per Sentence
 * key, holding the Segmented Sentence dumgen returned. It lives in a
 * hidden vault folder, outside VAM and the Library, read through
 * Obsidian's `vault.adapter`. Obsidian Sync skips hidden folders, so each
 * device fills its own; other sync tools may copy entries, which is
 * harmless because an entry is only ever the segmentation of its key.
 *
 * Losing an entry costs one re-segmentation, so the cache never fails
 * Classify: an entry that cannot be read or does not decode is a miss, and
 * a write that fails is logged and dropped. Failed segmentations are never
 * stored.
 */
import type { Route, SegmentedSentence, Unit } from "dumgen";
import { Context, Effect, Option, Schema } from "effect";
import { getErrorMessage } from "../../utils/get-error-message";

/** The hidden folder at the vault root that holds the cache. */
export const SEGMENTATION_CACHE_FOLDER = ".textfresser/segmentation";

export class SegmentationCache extends Context.Service<
	SegmentationCache,
	{
		/** The cached Segmented Sentence of a key, if a valid one is stored. */
		get(key: string): Effect.Effect<Option.Option<SegmentedSentence>>;
		/** Stores a successful segmentation under its key. */
		put(key: string, sentence: SegmentedSentence): Effect.Effect<void>;
	}
>()("textfresser/classify/SegmentationCache") {}

/** The subset of Obsidian's `DataAdapter` the cache uses. */
export type CacheFiles = {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
	write(path: string, data: string): Promise<void>;
	mkdir(path: string): Promise<void>;
};

const RouteSchema = Schema.Struct({
	family: Schema.String,
	kind: Schema.String,
	language: Schema.Literal("de"),
});

const SegmentedSentenceSchema = Schema.Struct({
	segments: Schema.Array(
		Schema.Struct({
			kind: Schema.Literals([
				"ResolvableText",
				"OpaqueText",
				"Whitespace",
				"Punctuation",
			]),
			surface: Schema.optionalKey(Schema.String),
			text: Schema.String,
		}),
	),
	text: Schema.String,
	units: Schema.Array(
		Schema.Struct({
			identity: Schema.optionalKey(
				Schema.Struct({
					canonicalForm: Schema.String,
					kind: Schema.Literals(["DET", "PRON"]),
					poss: Schema.optionalKey(Schema.Literal("Yes")),
					pronType: Schema.NullOr(Schema.String),
				}),
			),
			route: Schema.Union([Schema.Literal("Unresolved"), RouteSchema]),
			segments: Schema.Array(Schema.Int),
			variants: Schema.optionalKey(Schema.Array(RouteSchema)),
		}),
	),
});

const CacheEntrySchema = Schema.fromJsonString(
	Schema.Struct({
		format: Schema.Literal(1),
		key: Schema.String,
		sentence: SegmentedSentenceSchema,
	}),
);

const decodeEntry = Schema.decodeUnknownOption(CacheEntrySchema);

type DecodedSentence = (typeof SegmentedSentenceSchema)["Type"];

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

function asRoute(route: (typeof RouteSchema)["Type"]): Route {
	// Written by this cache from a dumgen Route under the same segmenter version.
	return { ...route } as Route;
}

/** The entry's path: keys are spread over 256 folders by their first two hex digits. */
export function cacheEntryPath(key: string): string {
	return `${SEGMENTATION_CACHE_FOLDER}/${key.slice(0, 2)}/${key}.json`;
}

function folderOf(path: string): string {
	return path.slice(0, path.lastIndexOf("/"));
}

/** Every folder from the vault root down to `folder`, outermost first. */
function foldersDownTo(folder: string): string[] {
	const parts = folder.split("/");
	return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}

/** The cache over hidden vault files. */
export function filesSegmentationCache(
	files: CacheFiles,
): SegmentationCache["Service"] {
	const get = (key: string) =>
		Effect.tryPromise({
			catch: (cause) => cause,
			try: async () => {
				const path = cacheEntryPath(key);
				if (!(await files.exists(path))) return Option.none<string>();
				return Option.some(await files.read(path));
			},
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
					getErrorMessage(error),
				).pipe(Effect.as(Option.none<SegmentedSentence>())),
			),
		);
	const put = (key: string, sentence: SegmentedSentence) =>
		Effect.tryPromise({
			catch: (cause) => cause,
			try: async () => {
				if (sentence.failed) return;
				const path = cacheEntryPath(key);
				for (const folder of foldersDownTo(folderOf(path)))
					if (!(await files.exists(folder)))
						await files.mkdir(folder);
				await files.write(
					path,
					JSON.stringify({ format: 1, key, sentence }),
				);
			},
		}).pipe(
			Effect.catch((error) =>
				Effect.logWarning(
					"[SegmentationCache] Could not store an entry:",
					getErrorMessage(error),
				),
			),
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
