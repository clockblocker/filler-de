/**
 * Generate command module exports.
 */

export { type GenerateDeps, generateCommand } from "./generate-command";
export { computeShardedFolderParts } from "./shard-path";
export {
	DICT_ENTRY_NOTE_KIND,
	EligibilitySchema,
	type GenerateContext,
	type GenerateError,
	GenerateErrorKind,
} from "./types";
