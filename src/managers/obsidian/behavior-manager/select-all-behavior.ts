import type {
	UserEventHandler,
	UserEventKind,
} from "@textfresser/obsidian-event-layer";
import { Effect } from "effect";
import { scrollBodyRange } from "../../../stateless-helpers/scroll-body-range";

/**
 * Create a handler for smart select-all.
 * Excludes frontmatter, go-back links, and metadata sections.
 */
export function createSelectAllHandler(): UserEventHandler<
	typeof UserEventKind.SelectAll
> {
	return {
		doesApply: (payload) => {
			const { from, to } = scrollBodyRange(payload.content);
			// Only intercept when we would set a custom selection (not passthrough)
			return (from !== 0 || to !== payload.content.length) && from < to;
		},
		handle: (payload) =>
			Effect.sync(() => {
				const { from, to } = scrollBodyRange(payload.content);

				// If the range covers everything or nothing, passthrough
				if (
					(from === 0 && to === payload.content.length) ||
					from >= to
				) {
					return { outcome: "passthrough" } as const;
				}

				// Return custom selection effect
				return {
					effect: { selection: { from, to } },
					outcome: "effect",
				} as const;
			}),
	};
}
