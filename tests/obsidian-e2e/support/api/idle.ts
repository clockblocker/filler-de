import type { Result } from "neverthrow";
import { PLUGIN_ID } from "../config";
import { obsidianWhenIdle } from "../internal/obsidian";

/**
 * Public: deterministic wait via plugin hook.
 * Call this after actions that schedule async plugin work.
 */
export async function whenIdle(pluginId: string = PLUGIN_ID): Promise<Result<void, string>> {
  return obsidianWhenIdle(pluginId);
}

/**
 * Public: wait for plugin to be idle; throws on error.
 * Use this in tests to wait for async plugin work to complete.
 */
export async function waitForIdle(pluginId: string = PLUGIN_ID): Promise<void> {
  const result = await obsidianWhenIdle(pluginId);
  if (result.isErr()) {
    throw new Error(`Failed to wait for idle: ${result.error}`);
  }
}