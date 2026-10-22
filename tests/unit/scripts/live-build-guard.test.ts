import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	isInstalledPluginDir,
	LIVE_BUILD_OVERRIDE,
	liveBuildRefusal,
} from "../../../scripts/live-build-guard";

const LIVE = "/Users/me/vault/.obsidian/plugins/textfresser";

describe("isInstalledPluginDir", () => {
	it("matches a vault's plugin folder itself", () => {
		expect(isInstalledPluginDir(LIVE)).toBe(true);
		expect(isInstalledPluginDir(`${LIVE}/`)).toBe(true);
		expect(isInstalledPluginDir(`${LIVE}/src/..`)).toBe(true);
	});

	it("does not match a worktree nested inside the plugin folder", () => {
		expect(isInstalledPluginDir(`${LIVE}/.claude/worktrees/x`)).toBe(false);
		expect(isInstalledPluginDir(`${LIVE}/src`)).toBe(false);
	});

	it("does not match the plugins folder, the config folder or look-alikes", () => {
		expect(isInstalledPluginDir("/Users/me/vault/.obsidian/plugins")).toBe(
			false,
		);
		expect(isInstalledPluginDir("/Users/me/vault/.obsidian")).toBe(false);
		expect(isInstalledPluginDir("/Users/me/obsidian/plugins/x")).toBe(false);
		expect(isInstalledPluginDir("/Users/me/.obsidian/plugin/x")).toBe(false);
		expect(isInstalledPluginDir("/private/tmp/tf-live-build-guard")).toBe(
			false,
		);
		expect(isInstalledPluginDir("/")).toBe(false);
	});
});

describe("liveBuildRefusal", () => {
	it("refuses the plugin folder and names the override", () => {
		const refusal = liveBuildRefusal(LIVE, {});
		expect(refusal).toContain(LIVE);
		expect(refusal).toContain(`${LIVE_BUILD_OVERRIDE}=1`);
	});

	it("allows the plugin folder when the override is 1", () => {
		expect(liveBuildRefusal(LIVE, { [LIVE_BUILD_OVERRIDE]: "1" })).toBe(
			undefined,
		);
		expect(
			liveBuildRefusal(LIVE, { [LIVE_BUILD_OVERRIDE]: "0" }),
		).toBeDefined();
	});

	it("allows a nested worktree", () => {
		expect(liveBuildRefusal(`${LIVE}/.claude/worktrees/x`, {})).toBe(
			undefined,
		);
	});

	it("refuses a checkout reached through a plugin-folder symlink", () => {
		const root = mkdtempSync(path.join(tmpdir(), "live-build-guard-"));
		try {
			const checkout = path.join(root, "checkout");
			const plugins = path.join(root, "vault", ".obsidian", "plugins");
			mkdirSync(checkout);
			mkdirSync(plugins, { recursive: true });
			const link = path.join(plugins, "textfresser");
			symlinkSync(checkout, link, "dir");
			expect(liveBuildRefusal(checkout, { PWD: link })).toContain(link);
			expect(liveBuildRefusal(link, {})).toContain(link);
			expect(liveBuildRefusal(checkout, { PWD: root })).toBe(undefined);
		} finally {
			rmSync(root, { force: true, recursive: true });
		}
	});
});
