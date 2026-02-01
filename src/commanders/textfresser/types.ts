/**
 * Textfresser types.
 */

import type { TextfresserContext } from "./deprecated-context/types";

// ─── State ───

export type TextfresserState = {
	latestNavigatedContext: TextfresserContext | null;
};
