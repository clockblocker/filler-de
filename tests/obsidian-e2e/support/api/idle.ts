import type { Result } from "neverthrow";
import { PLUGIN_ID } from "../config";
import { obsidianWaitForPluginInitialized, obsidianWhenIdle } from "../internal/obsidian";

/**
 * Public: wait for plugin to be initialized; throws on error.
 * Use this before waiting for idle to ensure plugin has started.
 */
export async function waitForPluginInitialized(pluginId: string = PLUGIN_ID, timeoutMs: number = 10000): Promise<void> {
  const result = await obsidianWaitForPluginInitialized(pluginId, timeoutMs);
  if (result.isErr()) {
    throw new Error(`Failed to wait for plugin initialization: ${result.error}`);
  }
}

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
 * Waits for plugin initialization first if needed.
 */
export async function waitForIdle(pluginId: string = PLUGIN_ID): Promise<void> {
  // First ensure plugin is initialized
  await waitForPluginInitialized(pluginId);
  // Then wait for idle
  const result = await obsidianWhenIdle(pluginId);
  if (result.isErr()) {
    throw new Error(`Failed to wait for idle: ${result.error}`);
  }
}