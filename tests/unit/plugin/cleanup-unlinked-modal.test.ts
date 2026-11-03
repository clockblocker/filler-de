import { describe, expect, it } from "bun:test";
import type { App } from "obsidian";
import { deviceWarning } from "../../../src/commanders/classify/cleanup-unlinked";
import { deviceSituation } from "../../../src/plugin/cleanup-unlinked-modal";

/** An app with Obsidian Sync on (leaving out `ignoreFolders`) or off, at `basePath`. */
const appWith = (options: { readonly sync?: { readonly ignoreFolders?: unknown }; readonly basePath?: string }) =>
	({
		internalPlugins: {
			getEnabledPluginById: (id: string) => (id === "sync" ? (options.sync ?? null) : null),
		},
		vault: { adapter: { getBasePath: () => options.basePath ?? "/Users/me/Vault" } },
	}) as unknown as App;

describe("Clean up unlinked Readings… on this device", () => {
	it("always says a Scroll not on this device does not count, and that removing reaches every device", () => {
		const [warning, ...found] = deviceWarning({ excludedFolders: [], iCloud: false, sync: false });
		expect(warning).toContain("no file on this device links it");
		expect(warning).toContain("selective Sync");
		expect(warning).toContain("iCloud");
		expect(warning).toContain("on every device your vault syncs to");
		expect(found).toEqual([]);
	});

	it("names Obsidian Sync's excluded folders, and an iCloud vault", () => {
		expect(
			deviceWarning({ excludedFolders: ["Archive", "Big"], iCloud: true, sync: true }).slice(1),
		).toEqual([
			"Obsidian Sync is on here and leaves out 2 folders (Archive, Big): a Scroll in them does not count.",
			"This vault is in iCloud Drive, which can offload files: an offloaded Scroll does not count.",
		]);
		expect(deviceWarning({ excludedFolders: [], iCloud: false, sync: true }).slice(1)).toEqual([
			"Obsidian Sync is on here: removing reaches your other devices.",
		]);
	});

	it("reads Sync, its excluded folders and an iCloud vault from the app", () => {
		expect(
			deviceSituation(
				appWith({
					basePath: "/Users/me/Library/Mobile Documents/iCloud~md~obsidian/Documents/Vault",
					sync: { ignoreFolders: ["Archive", 3] },
				}),
			),
		).toEqual({ excludedFolders: ["Archive"], iCloud: true, sync: true });
		expect(deviceSituation(appWith({}))).toEqual({ excludedFolders: [], iCloud: false, sync: false });
	});

	it("finds nothing it cannot read", () => {
		expect(deviceSituation({ vault: { adapter: {} } } as unknown as App)).toEqual({
			excludedFolders: [],
			iCloud: false,
			sync: false,
		});
	});
});
