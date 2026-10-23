import { makeRecentTrace } from "@textfresser/vault-action-manager/diagnostics";

/**
 * The plugin's recent spans and log entries: the plugin runtime records
 * every span and `Effect.log*` entry into it, and `logAtEdge` the few logs
 * made outside Effect. "Copy recent trace" copies it, and a Librarian stop
 * writes it to the console.
 */
export const recentTrace = makeRecentTrace();
