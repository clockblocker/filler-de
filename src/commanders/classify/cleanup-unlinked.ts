/**
 * "Clean up unlinked Readings…" (#290): the Readings the Reading lifetime
 * never removes by itself, because no transition it saw released them,
 * such as those a deleted Scroll alone linked, or those from before its
 * index. It lists every Reading with no Attestation and no link from a
 * file there now, shows the list as a dry run, and removes them only once
 * the user confirms, each again only while still unattested and unlinked,
 * once Classify, Knowledge runs and Sync have settled.
 *
 * "A file there" is one on this device: a Scroll selective Sync leaves out
 * or iCloud offloaded links nothing, and removing a Reading removes it on
 * every device Sync reaches. The dry run says so (`deviceWarning`).
 */
import { Effect } from "effect";
import type { ReadingLifetime } from "./resolution/reading-lifetime";

export const CLEANUP_UNLINKED_COMMAND_NAME = "Clean up unlinked Readings…";

/** What this device may be missing, as far as the plugin can tell cheaply. */
export type DeviceSituation = {
	/** Obsidian Sync is on in this vault. */
	readonly sync: boolean;
	/** The folders Obsidian Sync leaves out on this device. */
	readonly excludedFolders: readonly string[];
	/** The vault is in iCloud Drive, which offloads files. */
	readonly iCloud: boolean;
};

const folders = (paths: readonly string[]) =>
	`${paths.length} folder${paths.length === 1 ? "" : "s"} (${paths.join(", ")})`;

/**
 * The dry run's warning: what "unlinked" means on this device, and that
 * removing reaches every device, then what the plugin found here.
 */
export const deviceWarning = (situation: DeviceSituation): string[] => {
	const found: string[] = [];
	if (situation.sync)
		found.push(
			situation.excludedFolders.length > 0
				? `Obsidian Sync is on here and leaves out ${folders(situation.excludedFolders)}: a Scroll in them does not count.`
				: "Obsidian Sync is on here: removing reaches your other devices.",
		);
	if (situation.iCloud)
		found.push(
			"This vault is in iCloud Drive, which can offload files: an offloaded Scroll does not count.",
		);
	return [
		"A Reading is listed only when no file on this device links it. A Scroll that is not on this device, as one selective Sync leaves out or iCloud has offloaded, does not count, so a Reading only it links is listed too. Removing deletes the Reading notes on every device your vault syncs to.",
		...found,
	];
};

export type CleanupUnlinkedDeps = {
	readonly lifetime: Pick<ReadingLifetime, "unlinked" | "removeUnlinked">;
	/** Shows the dry run's Reading notes; answers whether the user confirmed removing them. */
	readonly confirm: (paths: readonly string[]) => Effect.Effect<boolean>;
	readonly notify: (message: string) => void;
};

const readings = (count: number) =>
	`${count} unlinked Reading${count === 1 ? "" : "s"}`;

/** Lists, confirms and removes; answers how many it removed. */
export const cleanupUnlinkedReadings = Effect.fn("cleanupUnlinkedReadings")(
	function* (deps: CleanupUnlinkedDeps) {
		const found = yield* deps.lifetime.unlinked;
		if (found.length === 0) {
			deps.notify(
				"No unlinked Readings: each has an Attestation or a link",
			);
			return 0;
		}
		const paths = found.map(({ path }) => path);
		if (!(yield* deps.confirm(paths))) return 0;
		const { kept, removed } = yield* deps.lifetime.removeUnlinked(
			paths,
			Effect.sync(() =>
				deps.notify(
					`Removing ${readings(paths.length)} once Classify, Knowledge runs and Sync have settled…`,
				),
			),
		);
		deps.notify(
			`✓ Removed ${readings(removed.length)}${kept.length > 0 ? `; kept ${kept.length} that gained an Attestation or a link` : ""}`,
		);
		return removed.length;
	},
);
