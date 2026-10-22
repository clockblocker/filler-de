import { type App, Modal } from "obsidian";

/**
 * Asks `message` under `title` with OK and Cancel; answers whether OK was
 * clicked. Closing the modal any other way answers Cancel.
 */
export function confirmInModal(
	app: App,
	title: string,
	message: string,
): Promise<boolean> {
	return new Promise((resolve) => {
		new ConfirmModal(app, title, message, resolve).open();
	});
}

/**
 * Simple confirmation modal with OK/Cancel buttons.
 */
class ConfirmModal extends Modal {
	private answered = false;

	constructor(
		app: App,
		private readonly title: string,
		private readonly message: string,
		private readonly onResult: (confirmed: boolean) => void,
	) {
		super(app);
	}

	override onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: this.title });
		contentEl.createEl("p", { text: this.message });

		const buttonContainer = contentEl.createDiv({
			cls: "modal-button-container",
		});

		const cancelBtn = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelBtn.addEventListener("click", () => {
			this.answer(false);
			this.close();
		});

		const confirmBtn = buttonContainer.createEl("button", {
			cls: "mod-cta",
			text: "OK",
		});
		confirmBtn.addEventListener("click", () => {
			this.answer(true);
			this.close();
		});
	}

	override onClose() {
		const { contentEl } = this;
		contentEl.empty();
		this.answer(false);
	}

	private answer(confirmed: boolean): void {
		if (this.answered) return;
		this.answered = true;
		this.onResult(confirmed);
	}
}
