import type { EditorView } from "@codemirror/view";
import { type App, MarkdownView } from "obsidian";
import type { RenderedActionConfig } from "../../wip-configs/actions/types";

/**
 * Floating toolbar that appears above text selection.
 * Reactive design: call update() with actions, toolbar shows/hides automatically.
 * @deprecated
 */
export class DeprecatedAboveSelectionToolbarService {
	private toolbarEl: HTMLDivElement | null = null;

	constructor(private app: App) {}

	/**
	 * Update toolbar with new actions. Shows if actions exist + selection present, hides otherwise.
	 */
	public update(actions: RenderedActionConfig[]): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || view.getMode() !== "source") {
			this.hide();
			return;
		}

		// biome-ignore lint/suspicious/noExplicitAny: <cm exists but not in types>
		const cm: EditorView | undefined = (view.editor as any)?.cm;
		if (!cm) {
			this.hide();
			return;
		}

		const selection = cm.state.selection.main;
		if (selection.empty || actions.length === 0) {
			this.hide();
			return;
		}

		this.ensureToolbar(cm);
		this.renderButtons(actions);
		this.position(cm, selection);
	}

	/**
	 * Hide and detach toolbar.
	 */
	public hide(): void {
		if (this.toolbarEl) {
			this.toolbarEl.style.display = "none";
		}
	}

	/**
	 * Full cleanup.
	 */
	public destroy(): void {
		if (this.toolbarEl?.parentElement) {
			this.toolbarEl.parentElement.removeChild(this.toolbarEl);
		}
		this.toolbarEl = null;
	}

	/**
	 * Ensure toolbar element exists and is attached to current editor.
	 */
	private ensureToolbar(cm: EditorView): void {
		const host = cm.dom as HTMLElement;

		// If toolbar exists but is in wrong parent, move it
		if (this.toolbarEl && this.toolbarEl.parentElement !== host) {
			this.toolbarEl.parentElement?.removeChild(this.toolbarEl);
			host.appendChild(this.toolbarEl);
		}

		// Create if doesn't exist
		if (!this.toolbarEl) {
			this.toolbarEl = document.createElement("div");
			this.toolbarEl.className = "selection-toolbar";
			Object.assign(this.toolbarEl.style, {
				background: "var(--background-secondary)",
				borderRadius: "6px",
				boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
				display: "none",
				gap: "4px",
				padding: "4px",
				pointerEvents: "auto",
				position: "absolute",
				zIndex: "1000",
			});
			host.style.position ||= "relative";
			host.appendChild(this.toolbarEl);
		}
	}

	/**
	 * Render action buttons.
	 */
	private renderButtons(actions: RenderedActionConfig[]): void {
		if (!this.toolbarEl) return;

		this.toolbarEl.innerHTML = "";
		for (const action of actions) {
			const btn = document.createElement("button");
			btn.dataset.action = action.id;
			btn.textContent = action.label;
			btn.disabled = action.disabled ?? false;
			Object.assign(btn.style, {
				background: action.disabled
					? "var(--background-modifier-hover)"
					: "var(--interactive-accent)",
				border: "none",
				borderRadius: "4px",
				color: action.disabled
					? "var(--text-muted)"
					: "var(--text-on-accent)",
				cursor: action.disabled ? "not-allowed" : "pointer",
				fontSize: "12px",
				fontWeight: "500",
				padding: "4px 8px",
			});
			this.toolbarEl.appendChild(btn);
		}
	}

	/**
	 * Position toolbar above selection.
	 */
	private position(
		cm: EditorView,
		selection: { from: number; to: number },
	): void {
		if (!this.toolbarEl) return;

		const from = cm.coordsAtPos(selection.from);
		const to = cm.coordsAtPos(selection.to);
		if (!from || !to) {
			this.hide();
			return;
		}

		const hostRect = (cm.dom as HTMLElement).getBoundingClientRect();
		const scrollTop = cm.scrollDOM.scrollTop;
		const scrollLeft = cm.scrollDOM.scrollLeft;

		// Show to measure
		this.toolbarEl.style.display = "flex";

		const toolbarHeight = this.toolbarEl.offsetHeight;
		const toolbarWidth = this.toolbarEl.offsetWidth;

		// Position above selection, centered
		const midX = (from.left + to.right) / 2;
		const top = Math.min(from.top, to.top);

		let left = midX - hostRect.left - toolbarWidth / 2 + scrollLeft;
		const topPos = top - hostRect.top - toolbarHeight - 8 + scrollTop;

		// Clamp horizontal position
		const maxLeft = cm.scrollDOM.scrollWidth - toolbarWidth - 8;
		left = Math.max(8, Math.min(left, maxLeft));

		this.toolbarEl.style.top = `${topPos}px`;
		this.toolbarEl.style.left = `${left}px`;
	}

	// Legacy methods for compatibility - can be removed after ButtonManager update
	public reattach(): void {
		// No-op, update() handles everything
	}

	public setActions(actions: RenderedActionConfig[]): void {
		this.update(actions);
	}

	public onCssChange(): void {
		this.hide();
	}
}
