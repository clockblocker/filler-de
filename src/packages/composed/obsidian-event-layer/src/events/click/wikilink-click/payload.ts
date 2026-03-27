import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { z } from "zod";
import { PayloadKind } from "../../../types/payload-base";
import { toSourcePath } from "../../source-path";

export const WikiTargetSchema = z.object({
	alias: z.string().optional(),
	basename: z.string(),
});

export type WikiTarget = z.infer<typeof WikiTargetSchema>;

export const WikilinkClickPayloadSchema = z.object({
	blockContent: z.string(),
	kind: z.literal(PayloadKind.WikilinkClicked),
	sourcePath: z.string(),
	target: WikiTargetSchema,
});

export type WikilinkClickPayload = z.infer<typeof WikilinkClickPayloadSchema>;

export function createWikilinkClickPayload(
	target: WikiTarget,
	blockContent: string,
	splitPath: SplitPathToMdFile,
): WikilinkClickPayload {
	return {
		blockContent,
		kind: PayloadKind.WikilinkClicked,
		sourcePath: toSourcePath(splitPath) ?? "",
		target,
	};
}
