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