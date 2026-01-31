/**
 * Generate command - re-export from textfresser commander.
 */

export {
	type GenerateDeps,
	generateCommand,
} from "../../../commanders/textfresser/commands/generate/generate-command";

// Re-export payload type for backward compatibility
export type GeneratePayload = Record<string, never>;
