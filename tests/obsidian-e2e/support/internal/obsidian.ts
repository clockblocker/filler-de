import { browser } from "@wdio/globals";
import { err, ok, type Result } from "neverthrow";

export async function obsidianFileExists(path: string): Promise<boolean> {
  return browser.executeObsidian(
    async ({ app }, p) => !!app.vault.getAbstractFileByPath(p),
    path,
  );
}

export async function obsidianVaultSample(limit: number): Promise<string[]> {
  return browser.executeObsidian(async ({ app }, lim) => {
    // Use getFiles() for consistency - it's stable and exists widely
    // Obsidian API: getFiles() returns TFile[], not in types but exists at runtime
    const files = app.vault.getFiles();
    return files.map((f: any) => f?.path).filter((p: any) => typeof p === "string").slice(0, lim);
  }, limit);
}

export async function obsidianWhenIdle(pluginId: string): Promise<Result<void, string>> {
  try {
    const result = await browser.executeObsidian(async ({ app }, id) => {
      // Obsidian API: app.plugins.plugins is not in types but exists at runtime
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plugin = (app as any).plugins?.plugins?.[id];
      if (!plugin) {
        return { error: `Plugin not found: ${id}`, ok: false as const };
      }
      if (typeof plugin.whenIdle !== "function") {
        return { error: `Plugin ${id} has no whenIdle() hook`, ok: false as const };
      }
      await plugin.whenIdle();
      return { ok: true as const };
    }, pluginId);
    if (result && typeof result === "object" && "ok" in result && !result.ok) {
      return err(result.error);
    }
    return ok(undefined);
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

export interface FolderChainCheck {
  missingFolder?: string;
  parentFolderContents?: string;
}

/**
 * Checks folder chain existence and lists parent folder contents if file not found.
 * Returns:
 * - missingFolder: first missing folder in chain (if any)
 * - parentFolderContents: tree-formatted listing of parent folder (if parent exists but file doesn't)
 */
export async function obsidianCheckFolderChainAndListParent(
  filePath: string,
): Promise<FolderChainCheck> {
  return browser.executeObsidian(async ({ app }, path) => {
    const parts = path.split("/");
    const fileName = parts.pop()!;
    const folderParts: string[] = [];
    let missingFolder: string | undefined;

    // Check each folder in chain
    for (const part of parts) {
      folderParts.push(part);
      const folderPath = folderParts.join("/");
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        missingFolder = folderPath;
        break;
      }
    }

    // If parent folder exists but file doesn't, list contents
    if (!missingFolder && folderParts.length > 0) {
      const parentPath = folderParts.join("/");
      const parent = app.vault.getAbstractFileByPath(parentPath);
      // Obsidian API: TFolder has children property, not in types but exists at runtime
      // TAbstractFile has name and path properties
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (parent && "children" in parent && Array.isArray((parent as any).children)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const children = (parent as any).children as Array<{ name: string; children?: unknown[] }>;
        if (children.length > 0) {
          // Build tree structure
          const treeLines: string[] = [];
          const buildTree = (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            items: Array<{ name: string; children?: any[] }>,
            prefix = "",
            isLast = true,
          ): void => {
            for (let i = 0; i < items.length; i++) {
              const item = items[i]!;
              const isLastItem = i === items.length - 1;
              const connector = isLastItem ? "└── " : "├── ";
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const hasChildren = item.children && Array.isArray(item.children) && item.children.length > 0;
              treeLines.push(`${prefix}${connector}${item.name}${hasChildren ? "/" : ""}`);

              if (hasChildren) {
                const nextPrefix = prefix + (isLastItem ? "    " : "│   ");
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                buildTree(item.children as Array<{ name: string; children?: any[] }>, nextPrefix, isLastItem);
              }
            }
          };

          buildTree(children);
          const parentDisplay = folderParts.join("/") + "/";
          return {
            parentFolderContents: `file ${fileName} not found among:\n${parentDisplay}\n${treeLines.join("\n")}`,
          };
        }
      }
    }

    return { missingFolder };
  }, filePath);
}