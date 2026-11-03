/** The dry run of "Clean up unlinked Readings…", as a modal (#290). */
import { Effect } from "effect";
import { type App, Modal } from "obsidian";

class CleanupUnlinkedModal extends Modal {
	private confirmed = false;

	constructor(
		app: App,
		private readonly paths: readonly string[],
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
			text: `${count} have no Attestation, and no note outside Worter/ links them or their Lemma. Removing one removes its Reading note, its Lemma with its last Reading, and the Surfaces nothing else names. Nothing is removed until you confirm.`,
		});
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
			const modal = new CleanupUnlinkedModal(app, paths, (confirmed) =>
				resume(Effect.succeed(confirmed)),
			);
			modal.open();
			return Effect.sync(() => modal.close());
		});
