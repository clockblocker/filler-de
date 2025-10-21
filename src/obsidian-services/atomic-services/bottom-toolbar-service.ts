import { type App, MarkdownView } from 'obsidian';
import type { AnyActionConfig } from '../../wip-configs/actions/types';

export class BottomToolbarService {
	private overlayEl: HTMLElement | null = null;
	private attachedView: MarkdownView | null = null;
	private actionConfigs: AnyActionConfig[] = [];

	constructor(private app: App) {}

	public init(): void {
		if (!this.overlayEl) this.overlayEl = this.createOverlay();
	}

	public reattach(): void {
		const view = this.getActiveMarkdownView();
		if (view && this.attachedView === view && this.overlayEl?.isConnected)
			return;

		this.detach();

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

	public detach(): void {
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

	public setActions(actionConfigs: AnyActionConfig[]): void {
		this.actionConfigs = actionConfigs;
		if (this.overlayEl) this.renderButtons(this.overlayEl);
	}

	private getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	private renderButtons(
		host: HTMLElement,
		actionsToRender?: AnyActionConfig[]
	): void {
		while (host.firstChild) host.removeChild(host.firstChild);
		const actions = actionsToRender || this.actionConfigs;
		for (const actionConfig of actions) {
			const b = document.createElement('button');
			// Ensure we set the action string, not the whole object
			b.dataset.action = actionConfig.id;
			b.className = 'my-bottom-overlay-btn';
			b.textContent = actionConfig.label;
			host.appendChild(b);
		}
	}
}
