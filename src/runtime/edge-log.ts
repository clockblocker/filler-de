import { recentTrace } from "../utils/recent-trace";
import { makeEdgeLog } from "./observability";

/**
 * The plugin's one log outside Effect, for plain TypeScript at an Obsidian
 * edge where no Effect runs (see `makeEdgeLog`). Each call site says why
 * it cannot log through `Effect.log*`.
 */
export const logAtEdge = makeEdgeLog(recentTrace);
