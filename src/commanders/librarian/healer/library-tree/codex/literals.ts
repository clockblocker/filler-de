import { z } from "zod";
import type { NodeName } from "../../../types/schemas/node-name";

/** Codex filename prefix */
export const CodexCoreNameSchema = z.literal("__");
export type PREFIX_OF_CODEX = z.infer<typeof CodexCoreNameSchema>;
export const PREFIX_OF_CODEX: NodeName = CodexCoreNameSchema.value as NodeName;
