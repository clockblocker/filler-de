import { App, MarkdownView } from 'obsidian';

export class OverlayService {
	private overlayEl: HTMLElement | null = null;
	private attachedView: MarkdownView | null = null;

	constructor(private app: App) {}

	public init(): void {
		if (!this.overlayEl) this.overlayEl = this.createOverlay();
	}

	public attachToActiveMarkdownView(): void {
		const view = this.getActiveMarkdownView();
		if (view && this.attachedView === view && this.overlayEl?.isConnected)
			return;

		this.detachOverlay();

		if (!view || !this.overlayEl) {
			this.attachedView = null;
			return;
		}

		const container = view.contentEl;
		container.addClass('bottom-overlay-host');
		container.appendChild(this.overlayEl);
		container.style.paddingBottom = '64px';
		this.attachedView = view;
	}

	public detachOverlay(): void {
		if (!this.overlayEl) return;

		if (this.attachedView) {
			const oldHost = this.attachedView.contentEl;
			oldHost.style.paddingBottom = '';
			oldHost.removeClass('bottom-overlay-host');
		}

		if (this.overlayEl.parentElement) {
			this.overlayEl.parentElement.removeChild(this.overlayEl);
		}

		this.attachedView = null;
	}

	private createOverlay(): HTMLElement {
		const el = document.createElement('div');
		el.className = 'my-bottom-overlay';

		const btn1 = this.makeButton('Toggle Edit/Preview', async () => {
			console.log('123');
		});

		const btn2 = this.makeButton('Copy Note Link', async () => {
			const file = this.attachedView?.file;
			if (!file) return;
			const link = `[[${file.path}]]`;
			await navigator.clipboard.writeText(link);
		});

		const btn3 = this.makeButton('Backlinks', () => {
			// @ts-ignore
			this.app.commands.executeCommandById('backlink:open');
		});

		el.append(btn1, btn2, btn3);
		document.body.classList.add('hide-status-bar');
		return el;
	}

	private makeButton(label: string, onClick: () => void): HTMLButtonElement {
		const b = document.createElement('button');
		b.className = 'my-bottom-overlay-btn';
		b.textContent = label;
		b.addEventListener('click', onClick);
		return b;
	}

	private getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}
}
