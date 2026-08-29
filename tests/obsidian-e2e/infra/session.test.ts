import { describe, expect, it } from "bun:test";
import { createSessionManifest, DRIVER_COMMAND } from "./session";

describe("E2E session manifest", () => {
	it("publishes the stable runner/worker contract", () => {
		const manifest = createSessionManifest({
			artifactDir: "/tmp/e2e-artifacts",
			cliPath: "/Applications/Obsidian.app/Contents/MacOS/obsidian-cli",
			mode: "managed",
			sessionId: "session-1",
			vaultName: "greenfield-vault",
			vaultPath: "/tmp/greenfield-vault",
		});
		expect(manifest).toMatchObject({
			artifactDir: "/tmp/e2e-artifacts",
			driverCommand: DRIVER_COMMAND,
			mode: "managed",
			protocolVersion: 1,
			sessionId: "session-1",
			vaultName: "greenfield-vault",
			vaultPath: "/tmp/greenfield-vault",
		});
	});

	it("rejects relative paths before a worker is spawned", () => {
		expect(() =>
			createSessionManifest({
				artifactDir: "relative",
				cliPath: "/usr/local/bin/obsidian-cli",
				mode: "attached",
				vaultName: "vault",
				vaultPath: "/tmp/vault",
			}),
		).toThrow("artifactDir must be absolute");
	});
});
