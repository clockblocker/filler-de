/**
 * Generate command - re-export from textfresser commander.
 */

export {
	generateCommand,
	type GenerateDeps,
} from "../../../commanders/textfresser/generate";

// Re-export payload type for backward compatibility
export type GeneratePayload = Record<string, never>;
