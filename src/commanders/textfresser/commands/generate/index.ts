/**
 * Generate command module exports.
 */

export {
	type CommandError as GenerateError,
	CommandErrorKind as GenerateErrorKind,
	DICT_ENTRY_NOTE_KIND,
	EligibilitySchema,
} from "../types";
export { generateCommand } from "./generate-command";
export { computeShardedFolderParts } from "./shard-path";
