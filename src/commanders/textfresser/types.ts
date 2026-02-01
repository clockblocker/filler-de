/**
 * Textfresser types.
 */

import type { Attestation } from "./dtos/attestation/types";

// ─── State ───

export type TextfresserState = {
	attestationForLatestNavigated: Attestation | null;
};
