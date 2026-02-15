/**
 * PayloadBase - base type for all event payloads.
 *
 * All payloads include:
 * - kind: Discriminator for the payload type
 * - splitPath: File context (may be optional for some events)
 */

import { z } from "zod";
import { SplitPathToMdFileSchema } from "../../vault-action-manager/types/split-path";

export const PayloadKindSchema = z.enum([
	"CheckboxClicked",
	"CheckboxInFrontmatterClicked",
	"ActionElementClicked",
	"ClipboardCopy",
	"SelectAll",
	"WikilinkCompleted",
	"WikilinkClicked",
	"SelectionChanged",
]);

export type PayloadKind = z.infer<typeof PayloadKindSchema>;
export const PayloadKind = PayloadKindSchema.enum;

/**
 * Base schema for payloads that have file context.
 */
export const PayloadWithPathSchema = z.object({
	kind: PayloadKindSchema,
	splitPath: SplitPathToMdFileSchema,
});

/**
 * Base type for payloads with file context.
 */
export type PayloadWithPath = z.infer<typeof PayloadWithPathSchema>;

/**
 * Union type of all payload kinds.
 */
export type AnyPayload = { kind: PayloadKind };
