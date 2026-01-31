/**
 * Textfresser types.
 */

import type { TextfresserContext } from "./context/types";

// ─── State ───

export type TextfresserState = {
	latestNavigatedContext: TextfresserContext | null;
	latestSelectedContext: TextfresserContext | null;
};
