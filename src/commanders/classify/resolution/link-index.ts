/**
 * The Reading lifetime's link index, kept across restarts (#290): which
 * notes under `Worter/` each file outside it was last seen linking, and
 * the Readings a file was seen to stop linking. It lives in the plugin's
 * hidden folder, one file per device, so an index another device synced
 * in is never read: each device judges only the transitions it observed.
 *
 * Losing it costs only automatic removals, so it never fails its caller:
 * one that cannot be read or does not decode is empty, and a write that
 * fails is logged and dropped.
 */
import { Cause, Effect, Option } from "effect";
import { z } from "zod";
import type { CacheFiles } from "../segmentation-cache";

/** What the index holds. */
export type LinkIndexSnapshot = {
	/** Each file outside `Worter/` and the notes under it the file links. */
	readonly links: Readonly<Record<string, readonly string[]>>;
	/** The Reading notes a file was seen to stop linking, not yet judged. */
	readonly released: readonly string[];
};

export type LinkIndexStore = {
	readonly load: Effect.Effect<LinkIndexSnapshot | undefined>;
	readonly save: (snapshot: LinkIndexSnapshot) => Effect.Effect<void>;
};

const LINK_INDEX_FOLDER = "link-index";

const SnapshotSchema = z.object({
	format: z.literal(1),
	links: z.record(z.string(), z.array(z.string())),
	released: z.array(z.string()),
});

const parseJson = Option.liftThrowable((raw: string): unknown =>
	JSON.parse(raw),
);

/** The index over VAM's `hiddenFolder(HIDDEN_FOLDER)`, in this device's file. */
export function filesLinkIndex(
	files: CacheFiles,
	device: string,
): LinkIndexStore {
	const path = `${LINK_INDEX_FOLDER}/${device}.json`;
	return {
		load: Effect.gen(function* () {
			if (!(yield* files.exists(path))) return undefined;
			const raw = yield* files.read(path);
			return Option.getOrUndefined(
				Option.flatMap(parseJson(raw), (json) => {
					const parsed = SnapshotSchema.safeParse(json);
					return parsed.success
						? Option.some({
								links: parsed.data.links,
								released: parsed.data.released,
							})
						: Option.none();
				}),
			);
		}).pipe(
			Effect.catch((error) =>
				Effect.logWarning(
					"[LinkIndex] Could not read the link index; starting empty:",
					Cause.fail(error),
				).pipe(Effect.as(undefined)),
			),
			Effect.withTracerEnabled(false),
		),
		save: (snapshot) =>
			Effect.gen(function* () {
				if (!(yield* files.exists(LINK_INDEX_FOLDER)))
					yield* files.mkdir(LINK_INDEX_FOLDER);
				yield* files.write(
					path,
					JSON.stringify({ format: 1, ...snapshot }),
				);
			}).pipe(
				Effect.catch((error) =>
					Effect.logWarning(
						"[LinkIndex] Could not write the link index:",
						Cause.fail(error),
					),
				),
				Effect.withTracerEnabled(false),
			),
	};
}

/** The index in memory, for tests and for a plugin with no hidden folder. */
export function memoryLinkIndex(initial?: LinkIndexSnapshot): LinkIndexStore & {
	readonly current: () => LinkIndexSnapshot | undefined;
} {
	let held = initial;
	return {
		current: () => held,
		load: Effect.sync(() => held),
		save: (snapshot) =>
			Effect.sync(() => {
				held = snapshot;
			}),
	};
}
