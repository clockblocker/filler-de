/**
 * @deprecated Use support/api instead. This is a compatibility shim.
 * Re-exports from the new support API for backward compatibility.
 */

// Re-export API functions
export { waitForFile, waitForFileGone, waitForFiles, whenIdle } from "../support/api";

// Re-export config constants
export {
	EXTRA_INIT_HEALING_WAIT_MS,
	INIT_HEALING_WAIT_MS,
	OFFSET_AFTER_FILE_DELETION,
	OFFSET_AFTER_HEAL,
} from "../support/config";
export type { PollOptions } from "../support/internal/types";
