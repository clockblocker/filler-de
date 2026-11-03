/**
 * "Clean up unlinked Readings…" (#290): the Readings the Reading lifetime
 * never removes by itself, because no transition it saw released them,
 * such as those a deleted Scroll alone linked, or those from before its
 * index. It lists every Reading with no Attestation and no link from a
 * file there now, shows the list as a dry run, and removes them only once
 * the user confirms, each again only while still unattested and unlinked.
 */
import { Effect } from "effect";
import type { ReadingLifetime } from "./resolution/reading-lifetime";

export const CLEANUP_UNLINKED_COMMAND_NAME = "Clean up unlinked Readings…";

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
		const { kept, removed } = yield* deps.lifetime.removeUnlinked(paths);
		deps.notify(
			`✓ Removed ${readings(removed.length)}${kept.length > 0 ? `; kept ${kept.length} that gained an Attestation or a link, or waited for Classify` : ""}`,
		);
		return removed.length;
	},
);
