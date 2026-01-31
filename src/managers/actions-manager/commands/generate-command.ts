/**
 * Generate command - re-export from textfresser commander.
 * Note: Generate is now invoked via Textfresser.generate(), not directly.
 */

export { generateCommand } from "../../../commanders/textfresser/commands/generate/generate-command";

// Re-export payload type for backward compatibility
export type GeneratePayload = Record<string, never>;
