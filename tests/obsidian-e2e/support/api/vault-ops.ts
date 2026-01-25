import { browser } from "@wdio/globals";
import { err, ok, type Result } from "neverthrow";

/**
 * Validate and normalize file path.
 * Rejects empty paths, normalizes leading slashes, ensures filename exists.
 */
function validatePath(path: string): Result<string, string> {
	if (!path || path.trim() === "") {
		return err("Path cannot be empty");
	}

	// Normalize leading slash
	let normalized = path.startsWith("/") ? path.slice(1) : path;

	// Reject .. segments for safety
	if (normalized.includes("../") || normalized.includes("..\\")) {
		return err(`Path contains invalid segments: ${path}`);
	}

	// Ensure there's a filename part (not just folders)
	const parts = normalized.split("/");
	if (parts.length === 0 || parts[parts.length - 1] === "") {
		return err(`Path must include a filename: ${path}`);
	}

	return ok(normalized);
}

/**
 * Create a file via Obsidian API.
 * Automatically creates parent folders if needed.
 * Path validation: rejects empty paths, normalizes leading slashes, ensures filename exists.
 */
export async function createFile(
	path: string,
	content = "",
): Promise<Result<void, string>> {
	const validatedPathResult = validatePath(path);
	if (validatedPathResult.isErr()) {
		return err(validatedPathResult.error);
	}
	const validatedPath = validatedPathResult.value;

	try {
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
		return ok(undefined);
	} catch (error) {
		return err(error instanceof Error ? error.message : String(error));
	}
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
): Promise<Result<void, string>> {
	// Validate all paths first
	const validatedFiles: Array<{ path: string; content: string }> = [];
	for (const { path, content = "" } of files) {
		const pathResult = validatePath(path);
		if (pathResult.isErr()) {
			return err(pathResult.error);
		}
		validatedFiles.push({ content, path: pathResult.value });
	}

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
		const folderResult = await createFolder(folderPath);
		if (folderResult.isErr()) {
			return err(folderResult.error);
		}
	}

	// Now create files in parallel (safe since folders exist)
	// Use internal implementation to avoid re-creating folders
	try {
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
		return ok(undefined);
	} catch (error) {
		return err(error instanceof Error ? error.message : String(error));
	}
}

/**
 * Rename a file or folder via Obsidian API.
 */
export async function renamePath(
	oldPath: string,
	newPath: string,
): Promise<Result<void, string>> {
	try {
		const result = await browser.executeObsidian(
			async ({ app }, from, to) => {
				const file = app.vault.getAbstractFileByPath(from);
				if (!file) {
					return { error: `Path not found: ${from}`, ok: false as const };
				}
				await app.vault.rename(file, to);
				return { ok: true as const };
			},
			oldPath,
			newPath,
		);
		if (result && typeof result === "object" && "ok" in result && !result.ok) {
			return err(result.error);
		}
		return ok(undefined);
	} catch (error) {
		return err(error instanceof Error ? error.message : String(error));
	}
}

/**
 * Delete a file or folder via Obsidian API.
 */
export async function deletePath(path: string): Promise<Result<void, string>> {
	try {
		await browser.executeObsidian(async ({ app }, p) => {
			const file = app.vault.getAbstractFileByPath(p);
			if (file) await app.vault.trash(file, true);
		}, path);
		return ok(undefined);
	} catch (error) {
		return err(error instanceof Error ? error.message : String(error));
	}
}

/**
 * Create a folder via Obsidian API.
 * Idempotent: returns success if folder already exists.
 */
export async function createFolder(path: string): Promise<Result<void, string>> {
	try {
		await browser.executeObsidian(async ({ app }, p) => {
			const existing = app.vault.getAbstractFileByPath(p);
			if (existing) {
				// Folder already exists, that's fine
				return;
			}
			await app.vault.createFolder(p);
		}, path);
		return ok(undefined);
	} catch (error) {
		return err(error instanceof Error ? error.message : String(error));
	}
}

/**
 * List all files in vault (for debugging).
 */
export async function listAllFiles(): Promise<Result<string[], string>> {
	try {
		const files = await browser.executeObsidian(async ({ app }) => {
			return app.vault.getFiles().map((f) => f.path);
		});
		return ok(files);
	} catch (error) {
		return err(error instanceof Error ? error.message : String(error));
	}
}

/**
 * List files under a specific path prefix.
 */
export async function listFilesUnder(prefix: string): Promise<Result<string[], string>> {
	try {
		const files = await browser.executeObsidian(async ({ app }, p) => {
			return app.vault
				.getFiles()
				.filter((f) => f.path.startsWith(p))
				.map((f) => f.path);
		}, prefix);
		return ok(files);
	} catch (error) {
		return err(error instanceof Error ? error.message : String(error));
	}
}

/**
 * Read file content via Obsidian API.
 */
export async function readFile(path: string): Promise<Result<string, string>> {
	try {
		const content = await browser.executeObsidian(async ({ app }, p) => {
			const file = app.vault.getAbstractFileByPath(p);
			if (!file || !("extension" in file)) {
				return { error: `File not found: ${p}`, ok: false as const };
			}
			const content = await app.vault.read(file);
			return { content, ok: true as const };
		}, path);
		if (content && typeof content === "object" && "ok" in content) {
			if (!content.ok) {
				return err(content.error);
			}
			return ok(content.content);
		}
		return err("Unexpected result from executeObsidian");
	} catch (error) {
		return err(error instanceof Error ? error.message : String(error));
	}
}

/**
 * Modify file content via Obsidian API.
 */
export async function modifyFile(
	path: string,
	content: string,
): Promise<Result<void, string>> {
	try {
		const result = await browser.executeObsidian(
			async ({ app }, p, c) => {
				const file = app.vault.getAbstractFileByPath(p);
				if (!file || !("extension" in file)) {
					return { error: `File not found: ${p}`, ok: false as const };
				}
				await app.vault.modify(file, c);
				return { ok: true as const };
			},
			path,
			content,
		);
		if (result && typeof result === "object" && "ok" in result && !result.ok) {
			return err(result.error);
		}
		return ok(undefined);
	} catch (error) {
		return err(error instanceof Error ? error.message : String(error));
	}
}

/**
 * Open a file in the Obsidian editor.
 */
export async function openFile(path: string): Promise<Result<void, string>> {
	try {
		const result = await browser.executeObsidian(async ({ app }, p) => {
			const file = app.vault.getAbstractFileByPath(p);
			if (!file) {
				return { error: `File not found: ${p}`, ok: false as const };
			}
			if (!("extension" in file)) {
				return { error: `Path is not a file: ${p}`, ok: false as const };
			}
			const leaf = app.workspace.getLeaf(false);
			await leaf.openFile(file);
			return { ok: true as const };
		}, path);
		if (result && typeof result === "object" && "ok" in result && !result.ok) {
			return err(result.error);
		}
		return ok(undefined);
	} catch (error) {
		return err(error instanceof Error ? error.message : String(error));
	}
}

/**
 * Click a button by its data-action attribute.
 */
export async function clickButton(actionId: string): Promise<Result<void, string>> {
	try {
		const result = await browser.executeObsidian(async ({}, id) => {
			const btn = document.querySelector(`[data-action="${id}"]`) as HTMLElement | null;
			if (!btn) {
				return { error: `Button not found: data-action="${id}"`, ok: false as const };
			}
			btn.click();
			return { ok: true as const };
		}, actionId);
		if (result && typeof result === "object" && "ok" in result && !result.ok) {
			return err(result.error);
		}
		return ok(undefined);
	} catch (error) {
		return err(error instanceof Error ? error.message : String(error));
	}
}

/**
 * Click a codex checkbox that links to a specific target.
 * Opens the codex file, finds the checkbox on the line containing the link target, and dispatches mousedown.
 *
 * @param codexPath - Path to the codex file (e.g., "Library/Recipe/Pie/Berry/__-Berry-Pie-Recipe.md")
 * @param linkTarget - The wikilink target to find (e.g., "Steps-Berry-Pie-Recipe" or "__-Berry-Pie-Recipe")
 * @param displayName - Optional display name (alias) to search for if linkTarget is not found directly
 */
export async function clickCodexCheckbox(
	codexPath: string,
	linkTarget: string,
	displayName?: string,
): Promise<Result<void, string>> {
	// First open the file
	const openResult = await openFile(codexPath);
	if (openResult.isErr()) {
		return err(`Failed to open codex: ${openResult.error}`);
	}

	// Wait for file to open and render
	await browser.pause(500);

	// Verify we're viewing the correct file
	const verifyResult = await browser.executeObsidian(
		async ({ app }, expectedPath) => {
			const activeFile = app.workspace.getActiveFile();
			if (!activeFile) {
				return { actualPath: "no-active-file", ok: false };
			}
			if (activeFile.path !== expectedPath) {
				return { actualPath: activeFile.path, ok: false };
			}
			return { ok: true };
		},
		codexPath,
	);

	if (verifyResult && typeof verifyResult === "object" && "ok" in verifyResult && !verifyResult.ok) {
		const actualPath = "actualPath" in verifyResult ? verifyResult.actualPath : "unknown";
		return err(`File not switched: expected ${codexPath}, got ${actualPath}`);
	}

	// Extract display name from linkTarget if not provided
	// For "Steps-Berry-Pie-Recipe" -> "Steps"
	// For "__-Berry-Pie-Recipe" -> "Berry" (special codex case)
	const computedDisplayName = displayName ?? extractDisplayName(linkTarget);

	try {
		const result = await browser.executeObsidian(
			async ({}, { displayName: dn, target }) => {
				// Find all task checkboxes
				const checkboxes = Array.from(
					document.querySelectorAll<HTMLInputElement>("input.task-list-item-checkbox")
				);

				// Collect debug info for all checkboxes
				const debugLines: string[] = [];

				// Find the checkbox whose line/list-item contains the link target
				for (const checkbox of checkboxes) {
					// Get the parent line/list element
					const lineEl = checkbox.closest(".cm-line") ?? checkbox.closest("li");
					if (!lineEl) {
						debugLines.push("checkbox-no-line");
						continue;
					}

					// Collect debug info
					const lineText = lineEl.textContent ?? "";
					const internalLinks = Array.from(lineEl.querySelectorAll("a.internal-link"))
						.map((a) => (a as HTMLAnchorElement).getAttribute("data-href"))
						.filter(Boolean);
					debugLines.push(`"${lineText.trim()}" [${internalLinks.join(",")}]`);

					// Strategy 1: Check for internal link with matching data-href (reading mode)
					let internalLink = lineEl.querySelector<HTMLAnchorElement>(
						`a.internal-link[data-href="${target}"]`
					);
					if (!internalLink) {
						internalLink = lineEl.querySelector<HTMLAnchorElement>(
							`a.internal-link[data-href="${target}.md"]`
						);
					}
					if (!internalLink) {
						const allLinks = lineEl.querySelectorAll<HTMLAnchorElement>("a.internal-link");
						for (const link of allLinks) {
							const href = link.getAttribute("data-href") ?? "";
							if (href.includes(target)) {
								internalLink = link;
								break;
							}
						}
					}

					if (internalLink) {
						const mousedownEvent = new MouseEvent("mousedown", {
							bubbles: true,
							button: 0,
							cancelable: true,
							view: window,
						});
						checkbox.dispatchEvent(mousedownEvent);
						return { ok: true };
					}

					// Strategy 2: Check raw text for [[target| or [[target]] (edit mode)
					if (lineText.includes(`[[${target}|`) || lineText.includes(`[[${target}]]`)) {
						const mousedownEvent = new MouseEvent("mousedown", {
							bubbles: true,
							button: 0,
							cancelable: true,
							view: window,
						});
						checkbox.dispatchEvent(mousedownEvent);
						return { ok: true };
					}

					// Strategy 3: Check for display name in the rendered text (reading mode with aliases)
					// The lineText would be just the alias like "Steps" or "Ingredients"
					if (dn && lineText.trim() === dn) {
						const mousedownEvent = new MouseEvent("mousedown", {
							bubbles: true,
							button: 0,
							cancelable: true,
							view: window,
						});
						checkbox.dispatchEvent(mousedownEvent);
						return { ok: true };
					}
				}

				const debugMsg = debugLines.length > 0 ? ` Lines: ${debugLines.join(" | ")}` : "";
				return {
					error: `Checkbox not found for link target: ${target} (displayName: ${dn}). Found ${checkboxes.length} checkboxes.${debugMsg}`,
					ok: false,
				};
			},
			{ displayName: computedDisplayName, target: linkTarget },
		);

		if (result && typeof result === "object" && "ok" in result && !result.ok) {
			return err(result.error);
		}
		return ok(undefined);
	} catch (error) {
		return err(error instanceof Error ? error.message : String(error));
	}
}

/**
 * Extract display name from link target.
 * "Steps-Berry-Pie-Recipe" -> "Steps"
 * "__-Berry-Pie-Recipe" -> "Berry"
 */
function extractDisplayName(linkTarget: string): string {
	// Special case for codex files: "__-Berry-Pie-Recipe" -> "Berry"
	if (linkTarget.startsWith("__-")) {
		const withoutPrefix = linkTarget.slice(3); // "Berry-Pie-Recipe"
		const parts = withoutPrefix.split("-");
		return parts[0] ?? linkTarget;
	}

	// Regular case: "Steps-Berry-Pie-Recipe" -> "Steps"
	const parts = linkTarget.split("-");
	return parts[0] ?? linkTarget;
}

