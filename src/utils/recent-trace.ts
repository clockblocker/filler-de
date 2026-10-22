import { makeRecentTrace } from "@textfresser/vault-action-manager/diagnostics";

/**
 * The plugin's recent spans and log entries: VAM's runtime and the
 * lifecycle's commands record into it, and so does `logger`. "Copy recent
 * trace" copies it, and a Librarian stop writes it to the console.
 */
export const recentTrace = makeRecentTrace();
