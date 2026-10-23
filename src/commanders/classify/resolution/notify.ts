import { Effect } from "effect";

/**
 * Shows the user a notice through `notify`, Obsidian's `Notice` until #229
 * brings `Notices`. A notice that cannot be shown is logged, and fails
 * nothing.
 */
export const tellUser =
	(notify: ((message: string) => void) | undefined) =>
	(message: string): Effect.Effect<void> =>
		notify === undefined
			? Effect.void
			: Effect.try(() => notify(message)).pipe(
					Effect.catch((error) =>
						Effect.logWarning(
							"[Classify] Could not show a notice:",
							error,
						),
					),
				);
