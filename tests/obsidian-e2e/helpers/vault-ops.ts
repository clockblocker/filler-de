import { browser } from "@wdio/globals";

/**
 * Create a file via Obsidian API.
 * Automatically creates parent folders if needed.
 */
export async function createFile(
	path: string,
	content = "",
): Promise<void> {
	await browser.executeObsidian(
		async ({ app }, p, c) => {
			// Ensure parent folders exist
			const parts = p.split("/");
			parts.pop(); // remove filename
			let currentPath = "";
			for (const part of parts) {
				currentPath = currentPath ? `${currentPath}/${part}` : part;
				const folder = app.vault.getAbstractFileByPath(currentPath);
				if (!folder) {
					await app.vault.createFolder(currentPath);
				}
			}
			await app.vault.create(p, c);
		},
		path,
		content,
	);
}

/**
 * Create multiple files in parallel via Obsidian API.
 * Automatically creates parent folders if needed.
 */
export async function createFiles(
	files: readonly { path: string; content?: string }[],
): Promise<void> {
	await Promise.all(
		files.map(({ path, content = "" }) => createFile(path, content)),
	);
}

/**
 * Rename a file or folder via Obsidian API.
 */
export async function renamePath(
	oldPath: string,
	newPath: string,
): Promise<void> {
	await browser.executeObsidian(
		async ({ app }, from, to) => {
			const file = app.vault.getAbstractFileByPath(from);
			if (!file) throw new Error(`Path not found: ${from}`);
			await app.vault.rename(file, to);
		},
		oldPath,
		newPath,
	);
}

/**
 * Delete a file or folder via Obsidian API.
 */
export async function deletePath(path: string): Promise<void> {
	await browser.executeObsidian(async ({ app }, p) => {
		const file = app.vault.getAbstractFileByPath(p);
		if (file) await app.vault.trash(file, true);
	}, path);
}

/**
 * Create a folder via Obsidian API.
 */
export async function createFolder(path: string): Promise<void> {
	await browser.executeObsidian(async ({ app }, p) => {
		await app.vault.createFolder(p);
	}, path);
}

/**
 * List all files in vault (for debugging).
 */
export async function listAllFiles(): Promise<string[]> {
	return browser.executeObsidian(async ({ app }) => {
		return app.vault.getFiles().map((f) => f.path);
	});
}

/**
 * List files under a specific path prefix.
 */
export async function listFilesUnder(prefix: string): Promise<string[]> {
	return browser.executeObsidian(async ({ app }, p) => {
		return app.vault
			.getFiles()
			.filter((f) => f.path.startsWith(p))
			.map((f) => f.path);
	}, prefix);
}

