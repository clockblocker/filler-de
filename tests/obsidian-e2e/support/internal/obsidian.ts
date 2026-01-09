import { browser } from "@wdio/globals";

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

export async function obsidianWhenIdle(pluginId: string): Promise<void> {
  await browser.executeObsidian(async ({ app }, id) => {
    // Obsidian API: app.plugins.plugins is not in types but exists at runtime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugin = (app as any).plugins?.plugins?.[id];
    if (!plugin) throw new Error(`Plugin not found: ${id}`);
    if (typeof plugin.whenIdle !== "function") {
      throw new Error(`Plugin ${id} has no whenIdle() hook`);
    }
    await plugin.whenIdle();
  }, pluginId);
}