import { browser } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

const VAULT_PATH = "tests/simple";
const PLUGIN_ID = "cbcr-text-eater-de";

describe("Codex toggle propagation", () => {
	beforeEach(async () => {
		await obsidianPage.resetVault(VAULT_PATH);
	});

	it("updates child codex when toggling child entry in parent codex", async () => {
		// Ensure plugin is enabled and commands registered
		await browser.executeObsidian(async ({ app, pluginId }) => {
			await app.plugins.enablePlugin(pluginId).catch(() => {});
			await app.plugins.loadPlugin(pluginId).catch(() => {});
			await app.commands.executeCommandById(
				"textfresser-testing-expose-opened-service",
			);
		}, { pluginId: PLUGIN_ID });

		await browser.executeObsidian(async ({ app, obsidian, pluginId }) => {
			const waitForPlugin = async () => {
				for (let i = 0; i < 50; i += 1) {
					try {
						await app.plugins.enablePlugin(pluginId);
					} catch {
						// ignore enable race
					}
					const loaded =
						app.plugins.getPlugin(pluginId) ??
						Object.values(
							app.plugins.plugins as Record<string, unknown>,
						).find(
							(p) =>
								(p as { manifest?: { id?: string } }).manifest
									?.id === pluginId,
						);
					if (loaded) return loaded;
					try {
						await app.plugins.loadPlugin(pluginId);
					} catch {
						// ignore load race
					}
					await new Promise((r) => setTimeout(r, 100));
				}
				return null;
			};

			const plugin = (await waitForPlugin()) as
				| {
						librarian?: {
							addNotes: (
								root: "Library",
								notes: Array<{
									path: string[];
									status: "Done" | "NotStarted";
								}>,
							) => Promise<void>;
							regenerateAllCodexes: () => Promise<void>;
						};
				  }
				| undefined;
			if (!plugin?.librarian) throw new Error("plugin not loaded");

			// Seed tree: Library/Parent/Child/Leaf
			await app.vault.createFolder("Library").catch(() => {});
			await app.vault.createFolder("Library/Parent").catch(() => {});
			await app.vault.createFolder("Library/Parent/Child").catch(() => {});

			await plugin.librarian.addNotes("Library", [
				{ path: ["Parent", "Child", "Leaf"], status: "NotStarted" },
			]);
			await plugin.librarian.regenerateAllCodexes();

			// Open parent codex so its checkboxes are in the DOM
			const parentCodex = app.vault.getAbstractFileByPath(
				"Library/Parent/__Parent.md",
			);
			if (!(parentCodex instanceof obsidian.TFile)) {
				throw new Error("parent codex missing");
			}
			const leaf = app.workspace.getLeaf(true);
			await leaf.openFile(parentCodex);
		}, { pluginId: PLUGIN_ID });

		// Click the checkbox for Child entry inside the parent codex
		await browser.pause(200);
		await browser.execute(() => {
			const checkbox = Array.from(
				document.querySelectorAll<HTMLInputElement>(
					".task-list-item-checkbox",
				),
			).find((cb) =>
				cb.closest("li")?.textContent?.includes("Child"),
			);
			if (!checkbox) throw new Error("checkbox not found");
			checkbox.click();
		});

		// Wait for codex regeneration to flip both parent + child codex entries to done
		await browser.waitUntil(
			async () => {
				const parentContent = await browser.executeObsidian(
					async ({ app }) =>
						app.vault.adapter.read("Library/Parent/__Parent.md"),
				);
				return parentContent.includes("- [x] [[__Child-Parent|Child]]");
			},
			{ interval: 200, timeout: 5000 },
		);

		const parentContent = await browser.executeObsidian(async ({ app }) =>
			app.vault.adapter.read("Library/Parent/__Parent.md"),
		);
		const childContent = await browser.executeObsidian(async ({ app }) =>
			app.vault.adapter.read("Library/Parent/Child/__Child-Parent.md"),
		);

		expect(parentContent).toContain("- [x] [[__Child-Parent|Child]]");
		expect(childContent).toContain("- [x] [[Leaf-Child-Parent|Leaf]]");
	});

	it("toggling a parent codex entry toggles all descendants", async () => {
		await browser.executeObsidian(async ({ app, pluginId }) => {
			await app.plugins.enablePlugin(pluginId).catch(() => {});
			await app.plugins.loadPlugin(pluginId).catch(() => {});
			await app.commands.executeCommandById(
				"textfresser-testing-expose-opened-service",
			);
		}, { pluginId: PLUGIN_ID });

		await browser.executeObsidian(async ({ app, obsidian, pluginId }) => {
			const waitForPlugin = async () => {
				for (let i = 0; i < 50; i += 1) {
					try {
						await app.plugins.enablePlugin(pluginId);
					} catch {
						// ignore enable race
					}
					const loaded =
						app.plugins.getPlugin(pluginId) ??
						Object.values(
							app.plugins.plugins as Record<string, unknown>,
						).find(
							(p) =>
								(p as { manifest?: { id?: string } }).manifest
									?.id === pluginId,
						);
					if (loaded) return loaded;
					try {
						await app.plugins.loadPlugin(pluginId);
					} catch {
						// ignore load race
					}
					await new Promise((r) => setTimeout(r, 100));
				}
				return null;
			};

			const plugin = (await waitForPlugin()) as
				| {
						librarian?: {
							addNotes: (
								root: "Library",
								notes: Array<{
									path: string[];
									status: "Done" | "NotStarted";
								}>,
							) => Promise<void>;
							regenerateAllCodexes: () => Promise<void>;
						};
				  }
				| undefined;
			if (!plugin?.librarian) throw new Error("plugin not loaded");

			await app.vault.createFolder("Library").catch(() => {});
			await app.vault.createFolder("Library/Рецепт").catch(() => {});
			await app.vault.createFolder("Library/Рецепт/Суп").catch(() => {});
			await app.vault
				.createFolder("Library/Рецепт/Суп/Рамен")
				.catch(() => {});

			await plugin.librarian.addNotes("Library", [
				{
					path: ["Рецепт", "Суп", "Рамен", "Мисо"],
					status: "NotStarted",
				},
				{
					path: ["Рецепт", "Суп", "Рамен", "Орерию_Шиё"],
					status: "NotStarted",
				},
				{
					path: ["Рецепт", "Суп", "Рамен", "Шин1"],
					status: "NotStarted",
				},
			]);
			await plugin.librarian.regenerateAllCodexes();

			const rootCodex = app.vault.getAbstractFileByPath(
				"Library/__Library.md",
			);
			if (!(rootCodex instanceof obsidian.TFile)) {
				throw new Error("root codex missing");
			}
			const leaf = app.workspace.getLeaf(true);
			await leaf.openFile(rootCodex);
		}, { pluginId: PLUGIN_ID });

		await browser.pause(200);
		await browser.execute(() => {
			const checkbox = Array.from(
				document.querySelectorAll<HTMLInputElement>(
					".task-list-item-checkbox",
				),
			).find((cb) =>
				cb.closest("li")?.textContent?.includes("__Рецепт"),
			);
			if (!checkbox) throw new Error("root section checkbox not found");
			checkbox.click();
		});

		await browser.waitUntil(
			async () => {
				const rootContent = await browser.executeObsidian(
					async ({ app }) =>
						app.vault.adapter.read("Library/__Library.md"),
				);
				return rootContent.includes("- [x] [[__Рецепт|Рецепт]]");
			},
			{ interval: 200, timeout: 5000 },
		);

		const rootContent = await browser.executeObsidian(async ({ app }) =>
			app.vault.adapter.read("Library/__Library.md"),
		);
		const sectionContent = await browser.executeObsidian(async ({ app }) =>
			app.vault.adapter.read("Library/Рецепт/__Рецепт.md"),
		);
		const childContent = await browser.executeObsidian(async ({ app }) =>
			app.vault.adapter.read("Library/Рецепт/Суп/__Суп-Рецепт.md"),
		);
		const leafContent = await browser.executeObsidian(async ({ app }) =>
			app.vault.adapter.read("Library/Рецепт/Суп/Рамен/__Рамен-Суп-Рецепт.md"),
		);

		expect(rootContent).toContain("- [x] [[__Рецепт|Рецепт]]");
		expect(sectionContent).toContain("- [x] [[__Суп-Рецепт|Суп]]");
		expect(childContent).toContain("- [x] [[__Рамен-Суп-Рецепт|Рамен]]");
		expect(leafContent).toContain(
			"- [x] [[Мисо-Рамен-Суп-Рецепт|Мисо]]",
		);
		expect(leafContent).toContain(
			"- [x] [[Орерию_Шиё-Рамен-Суп-Рецепт|Орерию Шиё]]",
		);
		expect(leafContent).toContain(
			"- [x] [[Шин1-Рамен-Суп-Рецепт|Шин1]]",
		);
	});
});
