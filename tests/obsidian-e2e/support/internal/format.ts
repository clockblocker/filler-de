import type { NonEmptyArray } from "../../../../src/types/helpers";
import logToFile from "../../../tracing/functions/write-log-to-file";
import { listFilesUnder } from "../api/vault-ops";
import type { FileWaitStatus } from "./types";

export function formatMissingFilesShort(
  missing: NonEmptyArray<Extract<FileWaitStatus, { ok: false }>>,
  callerContext?: string,
): string {
  const [__fistMissing, ...restMissing] = missing;
  const contextPrefix = callerContext ? `${callerContext} ` : "";
  const missingMessage = `${contextPrefix}Missing ${missing.length} file${restMissing.length > 0 ? "s" : ""}:`;
  return `${missingMessage}\n${missing.map((m) => `- ${m.path}`).join("\n")}\n`;
}

export async function formatMissingFilesLong(
  missing: Extract<FileWaitStatus, { ok: false }>[],
  cfg: { timeoutMs: number; intervalMs: number; callerContext?: string; logFolderOnFail?: string },
): Promise<string> {
  const lines: string[] = [];
  if (cfg.callerContext) {
    lines.push(`Caller: ${cfg.callerContext}`);
  }
  lines.push(`Polling: timeout=${cfg.timeoutMs}ms, interval=${cfg.intervalMs}ms`);
  lines.push("");

  for (const m of missing) {
    lines.push(`- Missing: ${m.path}`);
    lines.push(`  waited: ${m.waitedMs}ms, attempts: ${m.attempts}`);
    lines.push(`  final check: getAbstractFileByPath => ${m.finalObsidianSeesFile}`);
    if (m.folderChainCheck?.missingFolder) {
      lines.push(`  missing folder in chain: ${m.folderChainCheck.missingFolder}`);
    }
    if (m.folderChainCheck?.parentFolderContents) {
      lines.push(`  ${m.folderChainCheck.parentFolderContents}`);
    }
    if (m.vaultSample?.length) {
      lines.push(`  vault sample (first ${m.vaultSample.length}):`);
      for (const p of m.vaultSample) lines.push(`    - ${p}`);
    }
    lines.push("");
  }

  // Log folder contents to file on failure
  if (cfg.logFolderOnFail) {
    const folderResult = await listFilesUnder(cfg.logFolderOnFail);
    if (folderResult.isOk()) {
      const files = folderResult.value.sort();
      const content = [
        `=== FOLDER STATE: ${cfg.logFolderOnFail} ===`,
        ...files,
        "=== END FOLDER STATE ===",
      ].join("\n");
      const safeFolderName = cfg.logFolderOnFail.replace(/\//g, "_");
      logToFile(`fail_logs_${safeFolderName}.log`, content);
    }
  }

  return lines.join("\n");
}

export function formatNotGoneFilesShort(
  notGone: Array<{ path: string; waitedMs: number; attempts: number; finalObsidianSeesFile: boolean; vaultSample?: string[] }>,
  callerContext?: string,
): string {
  const first = notGone[0]!;
  const more = notGone.length > 1 ? ` (+${notGone.length - 1} more)` : "";
  const contextPrefix = callerContext ? `${callerContext} ` : "";
  return `${contextPrefix}Still exists ${notGone.length} file(s)${more}: ${first.path}`;
}

export function formatNotGoneFilesLong(
  notGone: Array<{ path: string; waitedMs: number; attempts: number; finalObsidianSeesFile: boolean; vaultSample?: string[] }>,
  cfg: { timeoutMs: number; intervalMs: number; callerContext?: string },
): string {
  const lines: string[] = [];
  if (cfg.callerContext) {
    lines.push(`Caller: ${cfg.callerContext}`);
  }
  lines.push(`Expected ${notGone.length} file(s) to be gone, but they still exist.`);
  lines.push(`Polling: timeout=${cfg.timeoutMs}ms, interval=${cfg.intervalMs}ms`);
  lines.push("");

  for (const f of notGone) {
    lines.push(`- Still exists: ${f.path}`);
    lines.push(`  waited: ${f.waitedMs}ms, attempts: ${f.attempts}`);
    lines.push(`  final check: getAbstractFileByPath => ${f.finalObsidianSeesFile}`);
    lines.push(`  hint: file still visible at end of timeout. May need longer wait or manual cleanup.`);
    if (f.vaultSample?.length) {
      lines.push(`  vault sample (first ${f.vaultSample.length}):`);
      for (const p of f.vaultSample) lines.push(`    - ${p}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}