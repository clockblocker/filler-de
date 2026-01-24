/**
 * TransformKind - discriminated union for behavior chain results.
 *
 * - proceedWithDefault: No change, let native behavior happen
 * - continue: Pass transformed data to next behavior
 * - skip: Stop chain, prevent default, do nothing
 * - replace: Stop chain, run custom action instead
 */

import { z } from "zod";

export const TransformKindSchema = z.enum([
	"proceedWithDefault",
	"continue",
	"skip",
	"replace",
]);

export type TransformKind = z.infer<typeof TransformKindSchema>;
export const TransformKind = TransformKindSchema.enum;

/**
 * Result of a behavior transformation.
 * Discriminated by `kind` field.
 */
export type TransformResult<P> =
	| { kind: typeof TransformKind.proceedWithDefault }
	| { kind: typeof TransformKind.continue; data: P }
	| { kind: typeof TransformKind.skip; reason?: string }
	| {
			kind: typeof TransformKind.replace;
			action: () => void | Promise<void>;
	  };

/**
 * Final result after chain execution.
 */
export type ChainResult<P> =
	| { outcome: "completed"; data: P }
	| { outcome: "skipped"; reason?: string }
	| { outcome: "replaced"; action: () => void | Promise<void> };
