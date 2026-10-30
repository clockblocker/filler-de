import type { SplitPathToMdFile } from "@textfresser/vault-action-manager";
import { z } from "zod";
import type { UserEventPayloadMap } from "../../../contracts";
import { PayloadKind } from "../../../types/payload-base";
import { toSourcePath } from "../../source-path";

const WikiTargetSchema = z.object({
	alias: z.string().optional(),
	basename: z.string(),
});

export type WikiTarget = z.infer<typeof WikiTargetSchema>;

const WikilinkClickPayloadSchema = z.object({
	blockContent: z.string(),
	kind: z.enum([PayloadKind.WikilinkClicked, PayloadKind.WikilinkObserved]),
	offset: z.int().nonnegative().optional(),
	sourcePath: z.string(),
	target: WikiTargetSchema,
});

type WikilinkClickPayload = z.infer<typeof WikilinkClickPayloadSchema>;

/** The two kinds a link click is told as: taken by a handler, or only observed. */
export type WikilinkClickKind = WikilinkClickPayload["kind"];

export function createWikilinkClickPayload<K extends WikilinkClickKind>(
	kind: K,
	target: WikiTarget,
	blockContent: string,
	splitPath: SplitPathToMdFile,
	offset: number | undefined,
): UserEventPayloadMap[K] {
	const payload: WikilinkClickPayload = {
		blockContent,
		kind,
		...(offset === undefined ? {} : { offset }),
		sourcePath: toSourcePath(splitPath) ?? "",
		target,
	};
	// Its kind is `K`, so it is that kind's payload.
	return payload as UserEventPayloadMap[K];
}
