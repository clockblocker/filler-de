/**
 * Textfresser types.
 */

import type { TextfresserContext } from "./context/types";

// ─── State ───

export type TextfresserState = {
	latestContext: TextfresserContext | null;
};
