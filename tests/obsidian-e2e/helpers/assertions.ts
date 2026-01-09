import { expect } from "@wdio/globals";
import { waitForFiles } from "./polling";

/**
 * Wait for files to exist and assert they all exist.
 * Provides clear error messages showing which file is missing.
 */
export async function expectFilesToExist(
	paths: readonly string[],
): Promise<void> {
	const files = await waitForFiles(paths);

	for (let i = 0; i < paths.length; i++) {
		if (!files[i]) {
			throw new Error(`Expected file to exist: ${paths[i]}`);
		}
		expect(files[i]).toBe(true);
	}
}
