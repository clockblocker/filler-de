import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { deployPlugins, TEXTFRESSER_PLUGIN_ID } from "./artifacts";

let temporaryRoot: string | undefined;

afterEach(async () => {
	if (temporaryRoot) await rm(temporaryRoot, { force: true, recursive: true });
	temporaryRoot = undefined;
});

async function makeArtifact(directory: string, id: string): Promise<void> {
	await mkdir(directory, { recursive: true });
	await writeFile(resolve(directory, "main.js"), `module.exports = ${JSON.stringify(id)};`);
	await writeFile(resolve(directory, "manifest.json"), JSON.stringify({ id }));
}

describe("E2E artifact deployment", () => {
	it("copies driver dependencies without deleting Textfresser settings", async () => {
		temporaryRoot = await mkdtemp(resolve(tmpdir(), "textfresser-artifacts-test-"));
		const vaultPath = resolve(temporaryRoot, "vault");
		const driverDir = resolve(temporaryRoot, "driver");
		const textfresserDir = resolve(temporaryRoot, "textfresser");
		const installedTextfresser = resolve(
			vaultPath,
			".obsidian/plugins",
			TEXTFRESSER_PLUGIN_ID,
		);
		await makeArtifact(driverDir, "test-driver");
		await writeFile(
			resolve(driverDir, "main.js"),
			'module.exports = require("./protocol");',
		);
		await writeFile(resolve(driverDir, "protocol.js"), "module.exports = 1;");
		await makeArtifact(textfresserDir, TEXTFRESSER_PLUGIN_ID);
		await mkdir(installedTextfresser, { recursive: true });
		await writeFile(resolve(installedTextfresser, "data.json"), "preserve-me");

		await deployPlugins({
			sessionId: "session-1",
			sources: {
				driverDir,
				driverId: "test-driver",
				textfresserDir,
				textfresserId: TEXTFRESSER_PLUGIN_ID,
			},
			vaultPath,
		});

		expect(await readFile(resolve(installedTextfresser, "data.json"), "utf8")).toBe(
			"preserve-me",
		);
		expect(
			await readFile(
				resolve(vaultPath, ".obsidian/plugins/test-driver/protocol.js"),
				"utf8",
			),
		).toBe("module.exports = 1;");
		expect(
			await readFile(
				resolve(vaultPath, ".obsidian/plugins/test-driver/main.js"),
				"utf8",
			),
		).not.toContain('require("./protocol")');
		expect(
			JSON.parse(
				await readFile(
					resolve(vaultPath, ".obsidian/plugins/test-driver/data.json"),
					"utf8",
				),
			),
		).toEqual({ protocol: 1, sessionId: "session-1" });
	});
});
