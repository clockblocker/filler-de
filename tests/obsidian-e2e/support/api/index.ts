export { type GatherDebugInfoOptions, gatherPluginDebugInfo, type PluginDebugInfo } from "./debug";
export {
	expectFilesToBeGone,
	expectFilesToExist,
	expectPostHealingFiles,
	type PostHealingExpectations,
	waitForFile,
	waitForFileGone,
	waitForFiles,
} from "./files";
export type { ExpectFilesGoneOptions } from "../internal/types";
export { whenIdle } from "./idle";
export { createFile, createFiles, createFolder, deletePath, listAllFiles, listFilesUnder, renamePath } from "./vault-ops";

import type { ExpectFilesGoneOptions, ExpectFilesOptions } from "../internal/types";
import { type GatherDebugInfoOptions, gatherPluginDebugInfo } from "./debug";
import { expectFilesToBeGone, expectFilesToExist, expectPostHealingFiles, type PostHealingExpectations } from "./files";

/**
 * Create a test context with bound callerContext for cleaner test code.
 */
export function createTestContext(testName: string) {
	return {
		expectFiles: (paths: readonly string[], opts?: Omit<ExpectFilesOptions, "callerContext">) =>
			expectFilesToExist(paths, { ...opts, callerContext: `[${testName}]` }),
		expectFilesGone: (paths: readonly string[], opts?: Omit<ExpectFilesGoneOptions, "callerContext">) =>
			expectFilesToBeGone(paths, { ...opts, callerContext: `[${testName}]` }),
		expectPostHealing: (expectations: PostHealingExpectations, opts?: Omit<ExpectFilesOptions, "callerContext">) =>
			expectPostHealingFiles(expectations, { ...opts, callerContext: `[${testName}]` }),
		gatherDebug: (folderFilter?: string, opts?: Omit<GatherDebugInfoOptions, "folderFilter" | "logPath">) =>
			gatherPluginDebugInfo({ ...opts, folderFilter, logPath: `/tmp/debug-${testName}.log` }),
	};
}
