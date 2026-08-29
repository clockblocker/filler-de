import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { resolve } from "node:path";
import { HarnessError } from "./errors";

interface LockOwner {
	readonly createdAt: string;
	readonly cwd: string;
	readonly hostname: string;
	readonly pid: number;
	readonly token: string;
}

export interface HarnessLock {
	readonly path: string;
	release(): Promise<void>;
}

const DEFAULT_STALE_MS = 30 * 60_000;

function processExists(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "EPERM";
	}
}

async function readOwner(path: string): Promise<LockOwner | undefined> {
	try {
		return JSON.parse(await readFile(resolve(path, "owner.json"), "utf8")) as LockOwner;
	} catch {
		return undefined;
	}
}

async function isStale(path: string, staleAfterMs: number): Promise<boolean> {
	const owner = await readOwner(path);
	if (owner?.hostname === hostname()) return !processExists(owner.pid);
	const ageMs = Date.now() - (await stat(path)).mtimeMs;
	return ageMs > staleAfterMs;
}

export async function acquireHarnessLock(options: {
	readonly path?: string;
	readonly staleAfterMs?: number;
} = {}): Promise<HarnessLock> {
	const path = resolve(
		options.path ??
			process.env.OBSIDIAN_E2E_LOCK_PATH ??
			resolve(tmpdir(), "textfresser-obsidian-e2e.lock"),
	);
	const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_MS;
	const owner: LockOwner = {
		createdAt: new Date().toISOString(),
		cwd: process.cwd(),
		hostname: hostname(),
		pid: process.pid,
		token: randomUUID(),
	};

	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			await mkdir(path);
			await writeFile(
				resolve(path, "owner.json"),
				`${JSON.stringify(owner, null, 2)}\n`,
				"utf8",
			);
			return {
				path,
				async release() {
					const current = await readOwner(path);
					if (current?.token === owner.token) {
						await rm(path, { force: true, recursive: true });
					}
				},
			};
		} catch (cause) {
			if ((cause as NodeJS.ErrnoException).code !== "EEXIST") {
				throw new HarnessError("LOCK_BUSY", `Could not acquire harness lock ${path}`, {
					cause,
				});
			}
			if (!(await isStale(path, staleAfterMs))) {
				const current = await readOwner(path);
				throw new HarnessError(
					"LOCK_BUSY",
					`Another Obsidian E2E session owns ${path}${current ? ` (pid ${current.pid}, since ${current.createdAt})` : ""}`,
				);
			}

			const stalePath = `${path}.stale-${randomUUID()}`;
			try {
				await rename(path, stalePath);
				await rm(stalePath, { force: true, recursive: true });
			} catch (recoveryError) {
				if ((recoveryError as NodeJS.ErrnoException).code !== "ENOENT") {
					throw new HarnessError(
						"LOCK_BUSY",
						`Could not recover stale harness lock ${path}`,
						{ cause: recoveryError },
					);
				}
			}
		}
	}

	throw new HarnessError("LOCK_BUSY", `Could not acquire harness lock ${path}`);
}
