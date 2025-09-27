import { App, MarkdownView } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { UserAction } from 'types/beta/system/actions';

export class AboveSelectionToolbarService {
	private toolbarEl: HTMLDivElement | null = null;
	private attachedView: MarkdownView | null = null;
	private cm: EditorView | null = null;
	private actions: { action: UserAction; label: string }[] = [];

	constructor(private app: App) {}

	public attach(): void {
		const view = this.getActiveMarkdownView();
		if (this.attachedView === view) return;

		this.detach();
		if (!view || view.getMode() !== 'source') return;

		// @ts-ignore - Obsidian exposes cm on editor
		const cm: EditorView = (view.editor as any).cm;
		this.cm = cm;
		this.attachedView = view;

		this.toolbarEl = this.createToolbar();
		const host = cm.dom as HTMLElement;
		host.style.position ||= 'relative';
		host.appendChild(this.toolbarEl);

		const showMaybe = () => setTimeout(() => this.updateToolbarPosition(), 0);
		const hide = () => this.hideToolbar();

		host.addEventListener('mouseup', showMaybe);
		host.addEventListener('keyup', showMaybe);
		cm.scrollDOM.addEventListener('scroll', hide, { passive: true } as any);
	}

	public detach(): void {
		this.hideToolbar();
		if (this.toolbarEl?.parentElement)
			this.toolbarEl.parentElement.removeChild(this.toolbarEl);
		this.toolbarEl = null;
		this.cm = null;
		this.attachedView = null;
	}

	public onCssChange(): void {
		this.hideToolbar();
	}

	private getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	private createToolbar(): HTMLDivElement {
		const el = document.createElement('div');
		el.className = 'selection-toolbar';
		el.style.display = 'none';
		this.renderButtons(el);
		return el;
	}

	public setActions(actions: { action: UserAction; label: string }[]): void {
		this.actions = Array.isArray(actions) ? actions : [];
		if (this.toolbarEl) this.renderButtons(this.toolbarEl);
		this.updateToolbarPosition();
	}

	private renderButtons(host: HTMLElement): void {
		while (host.firstChild) host.removeChild(host.firstChild);
		for (const a of this.actions) {
			const b = document.createElement('button');
			b.dataset.action = a.action;
			b.className = 'selection-toolbar-btn';
			b.textContent = a.label;
			host.appendChild(b);
		}
	}

	private hideToolbar() {
		if (this.toolbarEl) this.toolbarEl.style.display = 'none';
	}

	public updateToolbarPosition() {
		if (!this.cm || !this.toolbarEl || !this.attachedView) return;

		const sel = this.cm.state.selection.main;
		if (sel.empty) return this.hideToolbar();

		const from = this.cm.coordsAtPos(sel.from);
		const to = this.cm.coordsAtPos(sel.to);
		if (!from || !to) return this.hideToolbar();

		const hostRect = (this.cm.dom as HTMLElement).getBoundingClientRect();
		const midX =
			(Math.min(from.left, to.left) + Math.max(from.right, to.right)) / 2;
		const top = Math.min(from.top, to.top);

		const t = this.toolbarEl;
		t.style.display = 'block';
		t.style.position = 'absolute';
		t.style.top = `${top - hostRect.top - t.offsetHeight - 8 + this.cm.scrollDOM.scrollTop}px`;
		t.style.left = `${midX - hostRect.left - t.offsetWidth / 2 + this.cm.scrollDOM.scrollLeft}px`;

		const maxLeft = this.cm.scrollDOM.scrollWidth - t.offsetWidth - 8;
		const minLeft = 8;
		const leftNum = Math.max(
			minLeft,
			Math.min(parseFloat(t.style.left), maxLeft)
		);
		t.style.left = `${leftNum}px`;
	}
}
