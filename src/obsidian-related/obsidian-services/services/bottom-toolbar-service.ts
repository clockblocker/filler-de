import { App, MarkdownView } from 'obsidian';
import { UserAction } from 'obsidian-related/actions/types';
import { LabeledAction } from '../../actions/interface';
import { TextsManagerService } from './texts-manager-service';

export class BottomToolbarService {
	private overlayEl: HTMLElement | null = null;
	private attachedView: MarkdownView | null = null;
	private actions: { action: UserAction; label: string }[] = [];
	private textsManagerService?: TextsManagerService;

	constructor(private app: App) {}

	public init(): void {
		if (!this.overlayEl) this.overlayEl = this.createOverlay();
	}

	public async reattach(): Promise<void> {
		const view = this.getActiveMarkdownView();
		if (view && this.attachedView === view && this.overlayEl?.isConnected)
			return;

		this.detach();

		if (!view || !this.overlayEl) {
			this.attachedView = null;
			return;
		}

		// Filter actions based on current file state
		await this.updateActionsForCurrentFile(view);

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

	public setActions(actions: LabeledAction[]): void {
		this.actions = Array.isArray(actions) ? actions : [];
		if (this.overlayEl) this.renderButtons(this.overlayEl);
	}

	public setTextsManagerService(
		textsManagerService: TextsManagerService
	): void {
		this.textsManagerService = textsManagerService;
	}

	private getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	private async updateActionsForCurrentFile(view: MarkdownView): Promise<void> {
		if (!view.file || !this.textsManagerService) return;

		try {
			const hasEmptyMeta = await this.textsManagerService.hasEmptyMetaInfo(
				view.file
			);
			const isPageFile = view.file.basename.match(/^\d{4}-/); // Check if it's a page file (0000-xxx.md format)

			// Filter actions based on file state
			const filteredActions = this.actions.filter((action) => {
				if (action.action === UserAction.MakeText) {
					return hasEmptyMeta;
				}
				if (
					action.action === UserAction.NavigatePages ||
					action.action === UserAction.PreviousPage
				) {
					return isPageFile;
				}
				return true;
			});

			// Update the overlay with filtered actions
			if (this.overlayEl) {
				this.renderButtons(this.overlayEl, filteredActions);
			}
		} catch (error) {
			console.error('Error updating actions for current file:', error);
		}
	}

	private renderButtons(
		host: HTMLElement,
		actionsToRender?: { action: UserAction; label: string }[]
	): void {
		while (host.firstChild) host.removeChild(host.firstChild);
		const actions = actionsToRender || this.actions;
		for (const a of actions) {
			const b = document.createElement('button');
			b.dataset.action = a.action;
			b.className = 'my-bottom-overlay-btn';
			b.textContent = a.label;
			host.appendChild(b);
		}
	}
}
