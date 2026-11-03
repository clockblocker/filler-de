/** The dry run of "Clean up unlinked Readings…", as a modal (#290). */
import { Effect, Predicate } from "effect";
import { type App, Modal } from "obsidian";
import {
	type DeviceSituation,
	deviceWarning,
} from "../commanders/classify/cleanup-unlinked";

/** Obsidian Sync's core plugin, as Obsidian 1.x holds it beyond its typings. */
const syncInstance = (app: App): unknown => {
	const internal: unknown = Reflect.get(app, "internalPlugins");
	if (
		!Predicate.hasProperty(internal, "getEnabledPluginById") ||
		!Predicate.isFunction(internal.getEnabledPluginById)
	)
		return undefined;
	return internal.getEnabledPluginById.call(internal, "sync") ?? undefined;
};

/**
 * What the plugin can tell cheaply about what this device may be missing:
 * whether Obsidian Sync is on, the folders it leaves out, and whether the
 * vault is in iCloud Drive. What it cannot read counts as not found.
 */
export const deviceSituation = (app: App): DeviceSituation => {
	const sync = syncInstance(app);
	const ignored =
		Predicate.hasProperty(sync, "ignoreFolders") &&
		Array.isArray(sync.ignoreFolders)
			? (sync.ignoreFolders as unknown[]).filter(Predicate.isString)
			: [];
	const adapter: unknown = app.vault.adapter;
	// Desktop's `FileSystemAdapter.getBasePath()`, or the mobile adapter's `basePath`.
	const base: unknown =
		Predicate.hasProperty(adapter, "getBasePath") &&
		Predicate.isFunction(adapter.getBasePath)
			? adapter.getBasePath.call(adapter)
			: Predicate.hasProperty(adapter, "basePath")
				? adapter.basePath
				: undefined;
	const basePath = Predicate.isString(base) ? base : "";
	return {
		excludedFolders: ignored,
		iCloud: basePath.includes("Mobile Documents"),
		sync: sync !== undefined && sync !== null,
	};
};

class CleanupUnlinkedModal extends Modal {
	private confirmed = false;

	constructor(
		app: App,
		private readonly paths: readonly string[],
		private readonly situation: DeviceSituation,
		private readonly done: (confirmed: boolean) => void,
	) {
		super(app);
	}

	override onOpen() {
		const { contentEl } = this;
		const paths = this.paths;
		const count = `${paths.length} Reading${paths.length === 1 ? "" : "s"}`;
		contentEl.createEl("h2", { text: "Clean up unlinked Readings" });
		contentEl.createEl("p", {
			text: `${count} have no Attestation, and no note on this device outside Worter/ links them or their Lemma. Removing one removes its Reading note, its Lemma with its last Reading, and the Surfaces nothing else names. Nothing is removed until you confirm.`,
		});
		for (const text of deviceWarning(this.situation))
			contentEl.createEl("p", { cls: "mod-warning", text });
		const pre = contentEl.createEl("pre", { text: paths.join("\n") });
		pre.style.maxHeight = "50vh";
		pre.style.overflow = "auto";
		pre.style.userSelect = "text";
		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		buttons
			.createEl("button", { text: "Cancel" })
			.addEventListener("click", () => this.close());
		buttons
			.createEl("button", { cls: "mod-warning", text: `Remove ${count}` })
			.addEventListener("click", () => {
				this.confirmed = true;
				this.close();
			});
	}

	override onClose() {
		this.contentEl.empty();
		this.done(this.confirmed);
	}
}

/** Shows the list; answers whether the user confirmed. Interrupted, it closes the modal. */
export const confirmCleanup =
	(app: App) =>
	(paths: readonly string[]): Effect.Effect<boolean> =>
		Effect.callback<boolean>((resume) => {
			const modal = new CleanupUnlinkedModal(
				app,
				paths,
				deviceSituation(app),
				(confirmed) => resume(Effect.succeed(confirmed)),
			);
			modal.open();
			return Effect.sync(() => modal.close());
		});
