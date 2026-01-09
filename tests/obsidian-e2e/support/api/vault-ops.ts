import { browser } from "@wdio/globals";

/**
 * Validate and normalize file path.
 * Rejects empty paths, normalizes leading slashes, ensures filename exists.
 */
function validatePath(path: string): string {
	if (!path || path.trim() === "") {
		throw new Error("Path cannot be empty");
	}

	// Normalize leading slash
	let normalized = path.startsWith("/") ? path.slice(1) : path;

	// Reject .. segments for safety
	if (normalized.includes("../") || normalized.includes("..\\")) {
		throw new Error(`Path contains invalid segments: ${path}`);
	}

	// Ensure there's a filename part (not just folders)
	const parts = normalized.split("/");
	if (parts.length === 0 || parts[parts.length - 1] === "") {
		throw new Error(`Path must include a filename: ${path}`);
	}

	return normalized;
}

/**
 * Create a file via Obsidian API.
 * Automatically creates parent folders if needed.
 * Path validation: rejects empty paths, normalizes leading slashes, ensures filename exists.
 */
export async function createFile(
	path: string,
	content = "",
): Promise<void> {
	const validatedPath = validatePath(path);
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
					// Obsidian's createFolder is idempotent - safe to call if exists
					await app.vault.createFolder(currentPath);
				}
			}
			await app.vault.create(p, c);
		},
		validatedPath,
		content,
	);
}

/**
 * Create multiple files in parallel via Obsidian API.
 * Automatically creates parent folders if needed.
 * 
 * Race condition fix: Collect unique parent folders and create them first,
 * then create files in parallel. This prevents spurious failures from
 * parallel folder creation attempts.
 */
export async function createFiles(
	files: readonly { path: string; content?: string }[],
): Promise<void> {
	// Validate all paths first
	const validatedFiles = files.map(({ path, content = "" }) => ({
		content,
		path: validatePath(path),
	}));

	// Collect unique parent folders
	const parentFolders = new Set<string>();
	for (const { path } of validatedFiles) {
		const parts = path.split("/");
		parts.pop(); // remove filename
		let currentPath = "";
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			if (currentPath) {
				parentFolders.add(currentPath);
			}
		}
	}

	// Create all parent folders first (serialized to avoid race conditions)
	// Obsidian's createFolder is idempotent, but serializing prevents any edge cases
	for (const folderPath of parentFolders) {
		await createFolder(folderPath);
	}

	// Now create files in parallel (safe since folders exist)
	// Use internal implementation to avoid re-creating folders
	await Promise.all(
		validatedFiles.map(({ path, content }) =>
			browser.executeObsidian(
				async ({ app }, p, c) => {
					await app.vault.create(p, c);
				},
				path,
				content,
			),
		),
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

