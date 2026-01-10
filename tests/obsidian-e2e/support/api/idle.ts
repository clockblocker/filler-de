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