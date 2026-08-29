import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
	findRegisteredVaultId,
	registerManagedVault,
} from "./managed-vault-registry";

let temporaryRoot: string | undefined;

afterEach(async () => {
	if (temporaryRoot) await rm(temporaryRoot, { force: true, recursive: true });
	temporaryRoot = undefined;
});

describe("managed Obsidian vault registration", () => {
	it("resolves an already-registered attached vault by absolute path", async () => {
		temporaryRoot = await mkdtemp(resolve(tmpdir(), "textfresser-vault-registry-test-"));
		const registryPath = resolve(temporaryRoot, "obsidian.json");
		const vaultPath = resolve(temporaryRoot, "attached-vault");
		await mkdir(vaultPath);
		await writeFile(
			registryPath,
			JSON.stringify({
				vaults: {
					aaaaaaaaaaaaaaaa: { path: vaultPath, ts: 1 },
				},
			}),
		);

		await expect(findRegisteredVaultId(vaultPath, registryPath)).resolves.toBe(
			"aaaaaaaaaaaaaaaa",
		);
	});

	it("rejects an attached folder Obsidian does not know as a vault", async () => {
		temporaryRoot = await mkdtemp(resolve(tmpdir(), "textfresser-vault-registry-test-"));
		const registryPath = resolve(temporaryRoot, "obsidian.json");
		await writeFile(registryPath, JSON.stringify({ vaults: {} }));

		await expect(
			findRegisteredVaultId(resolve(temporaryRoot, "missing-vault"), registryPath),
		).rejects.toThrow("is not registered in Obsidian");
	});

	it("registers the disposable folder before launching it by vault ID", async () => {
		temporaryRoot = await mkdtemp(resolve(tmpdir(), "textfresser-vault-registry-test-"));
		const registryPath = resolve(temporaryRoot, "obsidian.json");
		const vaultPath = resolve(temporaryRoot, "managed-vault");
		await mkdir(vaultPath);
		await writeFile(
			registryPath,
			JSON.stringify({
				cli: true,
				vaults: {
					aaaaaaaaaaaaaaaa: { open: true, path: "/existing-vault", ts: 1 },
				},
			}),
		);

		const registration = await registerManagedVault({
			now: () => 42,
			registryPath,
			vaultId: "bbbbbbbbbbbbbbbb",
			vaultPath,
		});

		expect(registration.launchUri).toBe(
			"obsidian://open?vault=bbbbbbbbbbbbbbbb",
		);
		expect(JSON.parse(await readFile(registryPath, "utf8"))).toEqual({
			cli: true,
			vaults: {
				aaaaaaaaaaaaaaaa: { open: true, path: "/existing-vault", ts: 1 },
				bbbbbbbbbbbbbbbb: { path: vaultPath, ts: 42 },
			},
		});
	});

	it("removes only its registration after Obsidian updates the registry", async () => {
		temporaryRoot = await mkdtemp(resolve(tmpdir(), "textfresser-vault-registry-test-"));
		const registryPath = resolve(temporaryRoot, "obsidian.json");
		const vaultPath = resolve(temporaryRoot, "managed-vault");
		await mkdir(vaultPath);
		await writeFile(
			registryPath,
			JSON.stringify({
				cli: true,
				vaults: {
					aaaaaaaaaaaaaaaa: { path: "/existing-vault", ts: 1 },
				},
			}),
		);
		const registration = await registerManagedVault({
			registryPath,
			vaultId: "bbbbbbbbbbbbbbbb",
			vaultPath,
		});
		const duringRun = JSON.parse(await readFile(registryPath, "utf8"));
		duringRun.insider = true;
		duringRun.vaults.aaaaaaaaaaaaaaaa.ts = 2;
		duringRun.vaults.bbbbbbbbbbbbbbbb.open = true;
		await writeFile(registryPath, JSON.stringify(duringRun));

		await registration.unregister();

		expect(JSON.parse(await readFile(registryPath, "utf8"))).toEqual({
			cli: true,
			insider: true,
			vaults: {
				aaaaaaaaaaaaaaaa: { path: "/existing-vault", ts: 2 },
			},
		});
	});

	it("refuses to overwrite an existing vault ID", async () => {
		temporaryRoot = await mkdtemp(resolve(tmpdir(), "textfresser-vault-registry-test-"));
		const registryPath = resolve(temporaryRoot, "obsidian.json");
		const vaultPath = resolve(temporaryRoot, "managed-vault");
		await mkdir(vaultPath);
		await writeFile(
			registryPath,
			JSON.stringify({
				vaults: {
					bbbbbbbbbbbbbbbb: { path: "/someone-elses-vault", ts: 1 },
				},
			}),
		);

		await expect(
			registerManagedVault({
				registryPath,
				vaultId: "bbbbbbbbbbbbbbbb",
				vaultPath,
			}),
		).rejects.toThrow("already belongs to another vault");
	});
});
