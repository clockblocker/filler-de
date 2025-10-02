import { App, MarkdownView } from 'obsidian';
import { UserAction } from 'obsidian-related/actions/types';

export class BottomToolbarService {
	private overlayEl: HTMLElement | null = null;
	private attachedView: MarkdownView | null = null;
	private actions: { action: UserAction; label: string }[] = [];

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
		this.renderButtons(el);
		document.body.classList.add('hide-status-bar');
		return el;
	}

	public setActions(actions: { action: UserAction; label: string }[]): void {
		this.actions = Array.isArray(actions) ? actions : [];
		if (this.overlayEl) this.renderButtons(this.overlayEl);
	}

	private renderButtons(host: HTMLElement): void {
		while (host.firstChild) host.removeChild(host.firstChild);
		for (const a of this.actions) {
			const b = document.createElement('button');
			b.dataset.action = a.action;
			b.className = 'my-bottom-overlay-btn';
			b.textContent = a.label;
			host.appendChild(b);
		}
	}

	private getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}
}
