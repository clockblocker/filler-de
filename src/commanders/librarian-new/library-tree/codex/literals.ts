import { z } from "zod";
import type { NodeName } from "../../types/schemas/node-name";

/** Codex filename prefix */
export const CodexCoreNameSchema = z.literal("__");
export type CODEX_CORE_NAME = z.infer<typeof CodexCoreNameSchema>;
export const CODEX_CORE_NAME: NodeName =
	CodexCoreNameSchema.value as NodeName;
