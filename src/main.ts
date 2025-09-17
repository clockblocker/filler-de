import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	WorkspaceLeaf,
} from 'obsidian';
import { SettingsTab } from './settings';
import { DEFAULT_SETTINGS, TextEaterSettings } from './types';
import { ApiService } from './services/api-service';
import { DeprecatedFileService } from './file';

import newGenCommand from 'actions/new/new-gen-command';
import { OpenedFileService } from 'services/opened-file-service';
import { BackgroundFileService } from 'services/background-file-service';
import { EditorView } from '@codemirror/view';
import addBacklinksToCurrentFile from 'actions/old/addBacklinksToCurrentFile';
import fillTemplate from 'actions/old/fillTemplate';
import formatSelectionWithNumber from 'actions/old/formatSelectionWithNumber';
import getInfinitiveAndEmoji from 'actions/old/getInfinitiveAndEmoji';
import insertReplyFromC1Richter from 'actions/old/insertReplyFromC1Richter';
import insertReplyFromKeymaker from 'actions/old/insertReplyFromKeymaker';
import normalizeSelection from 'actions/old/normalizeSelection';
import translateSelection from 'actions/old/translateSelection';
import { WrappedBlockHtmlIo } from 'block-manager/wrapped-block-html-io';
import updateActionsBlock from 'actions/new/update-actions-block';
import { ACTION_BY_NAME } from 'actions/actions';

export default class TextEaterPlugin extends Plugin {
	settings: TextEaterSettings;
	apiService: ApiService;
	openedFileService: OpenedFileService;
	backgroundFileService: BackgroundFileService;
	blockManager: WrappedBlockHtmlIo;

	private toolbarEl: HTMLDivElement | null = null;
	private attachedView: MarkdownView | null = null;
	private cm: EditorView | null = null;
	private overlayEl: HTMLElement | null = null;

	deprecatedFileService: DeprecatedFileService;

	async onload() {
		try {
			await this.loadPlugin();
			this.addSettingTab(new SettingsTab(this.app, this));
		} catch (error) {
			console.error('Error during plugin initialization:', error);
			new Notice(`Plugin failed to load: ${error.message}`);
		}
	}

	async loadPlugin() {
		await this.loadSettings();
		await this.addCommands();

		this.apiService = new ApiService(this.settings);
		this.openedFileService = new OpenedFileService(this.app);
		this.backgroundFileService = new BackgroundFileService(
			this.app,
			this.app.vault
		);
		this.deprecatedFileService = new DeprecatedFileService(
			this.app,
			this.app.vault
		);

		this.blockManager = new WrappedBlockHtmlIo();

		this.registerDomEvent(document, 'click', (evt) => {
			const target = evt.target as HTMLElement;

			if (target.tagName === 'BUTTON') {
				const action = target.dataset.action;

				if (action === 'execute-new-gen-command') {
					ACTION_BY_NAME['Generate'](this);
				}
			}

			if (target.tagName === 'A') {
				const blockHtmlElement = target.parentElement?.parentElement;

				const children = blockHtmlElement?.children;
				if (children) {
					const blockIdElement = Array.from(children).find((c) =>
						c.classList.contains('cm-blockid')
					);

					if (blockIdElement) {
						const textContent = blockIdElement.textContent;
						console.log('blockIdElement', textContent, `\n\n\n`);
					}
				}
			}
		});

		this.registerEvent(
			this.app.vault.on('create', (af) => {
				if (!(af instanceof TFile) || af.extension !== 'md') return;

				onNewFileThenRun(this.app, af, () => {
					ACTION_BY_NAME['UpdateActionsBlock'](this);
				});
			})
		);

		this.app.workspace.onLayoutReady(() => {
			this.attachToActiveMarkdownView();
		});

		// Reattach when user switches panes/notes
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (_leaf: WorkspaceLeaf) => {
				this.attachToActiveMarkdownView();
			})
		);

		// Also re-check after major layout changes (splits, etc.)
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.attachToActiveMarkdownView();
			})
		);

		// Create overlay element once; we’ll move it between views
		this.overlayEl = this.createOverlay();
		this.app.workspace.onLayoutReady(() => this.attach());
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => this.attach())
		);
		this.registerEvent(
			this.app.workspace.on('layout-change', () => this.attach())
		);
	}

	onunload() {
		this.detachOverlay();
		this.detach();
	}

	private attachToActiveMarkdownView() {
		const view = this.getActiveMarkdownView();

		// If we’re already attached to this view, nothing to do
		if (view && this.attachedView === view && this.overlayEl?.isConnected)
			return;

		// Detach from old view if any
		this.detachOverlay();

		if (!view || !this.overlayEl) {
			this.attachedView = null;
			return;
		}

		// Attach to the new view’s content area
		// `view.contentEl` is the scrollable region for the note
		const container = view.contentEl;
		container.addClass('bottom-overlay-host');
		container.appendChild(this.overlayEl);

		// Ensure the overlay sits at the bottom of the content area
		// and does not hide the last lines: add bottom padding while present
		container.style.paddingBottom = '64px'; // match overlay height

		this.attachedView = view;
	}

	private detachOverlay() {
		if (!this.overlayEl) return;

		// Remove extra padding from old host
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

		// Example buttons — hook these up to your commands or logic
		const btn1 = this.makeButton('Toggle Edit/Preview', async () => {
			console.log('123');
		});

		const btn2 = this.makeButton('Copy Note Link', async () => {
			const file = this.attachedView?.file;
			if (!file) return;
			const link = `[[${file.path}]]`;
			await navigator.clipboard.writeText(link);
			new Notice('Note link copied');
		});

		const btn3 = this.makeButton('Backlinks', () => {
			// Example: open backlinks pane
			// You can also `app.commands.executeCommandById("backlink:open")` if you prefer command IDs
			// @ts-ignore (not typed in API, but present)
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

	private async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	private async addCommands() {
		this.addCommand({
			id: 'backlink-all-to-current-file',
			name: 'Populate all referenced files with a backlink to the current file',
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				const fileName = view.file?.name;
				const backlink = view.file?.basename;

				if (view.file && fileName && backlink) {
					if (!checking) {
						addBacklinksToCurrentFile(
							view.file,
							backlink,
							this.app.vault,
							this.app.metadataCache,
							editor
						);
					}
					return true;
				}

				return false;
			},
		});

		this.addCommand({
			id: 'fill-template',
			name: 'Generate a dictionary entry for the word in the title of the file',
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				if (view.file) {
					if (!checking) {
						fillTemplate(this, editor, view.file);
						// testEndgame(this, editor, view.file);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'get-infinitive-and-emoji',
			name: 'Get infinitive/normal form and emoji for current word',
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				if (view.file) {
					if (!checking) {
						getInfinitiveAndEmoji(this, editor, view.file);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'duplicate-selection',
			name: 'Add links to normal/inf forms to selected text',
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				const selection = editor.getSelection();
				if (selection && view.file) {
					if (!checking) {
						normalizeSelection(this, editor, view.file, selection);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'translate-selection',
			name: 'Translate selected text',
			editorCheckCallback: (checking: boolean, editor: Editor) => {
				const selection = editor.getSelection();
				if (selection) {
					if (!checking) {
						translateSelection(this, editor, selection);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'format-selection-with-number',
			name: 'Split selection into linked blocks',
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				const selection = editor.getSelection();
				if (selection && view.file) {
					if (!checking) {
						formatSelectionWithNumber(this, editor, view.file, selection);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'check-ru-de-translation',
			name: 'Keymaker',
			editorCheckCallback: (checking: boolean, editor: Editor) => {
				const selection = editor.getSelection();
				if (selection) {
					if (!checking) {
						insertReplyFromKeymaker(this, editor, selection);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'check-schriben',
			name: 'Schriben check',
			editorCheckCallback: (checking: boolean, editor: Editor) => {
				const selection = editor.getSelection();
				if (selection) {
					if (!checking) {
						insertReplyFromC1Richter(this, editor, selection);
					}
					return true;
				}
				return false;
			},
		});

		this.addCommand({
			id: 'new-gen-command',
			name: 'new-gen-command',
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				if (view.file) {
					if (!checking) {
						newGenCommand(this);
					}
					return true;
				}
				return false;
			},
		});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	findHighestNumber(content: string): number {
		const matches = content.match(/#\^(\d+)/g);
		if (!matches) return 0;

		const numbers = matches.map((match) => {
			const num = match.replace('#^', '');
			return parseInt(num, 10);
		});

		return Math.max(0, ...numbers);
	}

	private getActiveMarkdownView(): MarkdownView | null {
		return this.app.workspace.getActiveViewOfType(MarkdownView);
	}

	private attach() {
		const view = this.getActiveMarkdownView();
		if (this.attachedView === view) return;

		this.detach();
		if (!view || view.getMode() !== 'source') return; // Source mode only

		// CM6 EditorView
		// @ts-ignore - Obsidian exposes cm on editor
		const cm: EditorView = (view.editor as any).cm;
		this.cm = cm;
		this.attachedView = view;

		// Create toolbar once
		this.toolbarEl = this.createToolbar();
		const host = cm.dom as HTMLElement; // .cm-editor
		host.style.position ||= 'relative';
		host.appendChild(this.toolbarEl);

		const showMaybe = () => setTimeout(() => this.updateToolbarPosition(), 0);
		const hide = () => this.hideToolbar();

		// Listeners
		host.addEventListener('mouseup', showMaybe);
		host.addEventListener('keyup', showMaybe);
		cm.scrollDOM.addEventListener('scroll', hide, { passive: true });
		this.register(() => host.removeEventListener('mouseup', showMaybe));
		this.register(() => host.removeEventListener('keyup', showMaybe));
		this.register(() => cm.scrollDOM.removeEventListener('scroll', hide));

		// Hide on mode change (preview <-> source)
		this.registerEvent(this.app.workspace.on('css-change', hide));
	}

	private detach() {
		this.hideToolbar();
		if (this.toolbarEl?.parentElement)
			this.toolbarEl.parentElement.removeChild(this.toolbarEl);
		this.toolbarEl = null;
		this.cm = null;
		this.attachedView = null;
	}

	private createToolbar(): HTMLDivElement {
		const el = document.createElement('div');
		el.className = 'selection-toolbar';
		el.style.display = 'none';

		const mkBtn = (label: string, fn: () => void) => {
			const b = document.createElement('button');
			b.className = 'selection-toolbar-btn';
			b.textContent = label;
			b.onclick = (e) => {
				e.preventDefault();
				e.stopPropagation();
				fn();
			};
			return b;
		};

		el.append(
			mkBtn('Bold', () => this.wrap('**')),
			mkBtn('Italic', () => this.wrap('*')),
			mkBtn('Copy', async () => {
				const ed = this.attachedView?.editor;
				if (!ed) return;
				const s = ed.getSelection();
				if (s) await navigator.clipboard.writeText(s);
			})
		);
		return el;
	}

	private wrap(wrapper: string) {
		const ed = this.attachedView?.editor;
		if (!ed) return;
		const s = ed.getSelection();
		if (!s) return;
		ed.replaceSelection(`${wrapper}${s}${wrapper}`);
		this.updateToolbarPosition(); // keep it in place or hide if selection collapsed
	}

	private hideToolbar() {
		if (this.toolbarEl) this.toolbarEl.style.display = 'none';
	}

	private updateToolbarPosition() {
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

		// Position centered above selection
		const t = this.toolbarEl;
		t.style.display = 'block';
		t.style.position = 'absolute';
		t.style.top = `${top - hostRect.top - t.offsetHeight - 8 + this.cm.scrollDOM.scrollTop}px`;
		t.style.left = `${midX - hostRect.left - t.offsetWidth / 2 + this.cm.scrollDOM.scrollLeft}px`;

		// If it would go outside, nudge inside
		const maxLeft = this.cm.scrollDOM.scrollWidth - t.offsetWidth - 8;
		const minLeft = 8;
		const leftNum = Math.max(
			minLeft,
			Math.min(parseFloat(t.style.left), maxLeft)
		);
		t.style.left = `${leftNum}px`;
	}
}

// const clickListener = EditorView.domEventHandlers({
// 	click: (event) => {
// 	  const target = event.target as HTMLElement;
// 	  if (target.matches("button.my-btn")) {
// 		this.app.commands.executeCommandById('your:cmd');
// 		return true;
// 	  }
// 	  return false;
// 	}
//   });
//   this.registerEditorExtension(clickListener);

function onNewFileThenRun(
	app: App,
	file: TFile,
	run: (view: MarkdownView) => void
) {
	let timeout: number | null = null;

	// try immediately if it's already the active view
	const tryRun = () => {
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view.file?.path === file.path) {
			run(view);
			return true;
		}
		return false;
	};
	if (tryRun()) return;

	// wait for it to be opened
	const openRef = app.workspace.on('file-open', (opened) => {
		if (!opened || opened.path !== file.path) return;

		// once opened, debounce on 'modify' to wait for templates/other plugins
		const clearTimer = () => {
			if (timeout) {
				window.clearTimeout(timeout);
				timeout = null;
			}
		};

		const done = () => {
			clearTimer();
			// final guard: run against the active view of THIS file
			const view = app.workspace.getActiveViewOfType(MarkdownView);
			if (view && view.file?.path === file.path) run(view);
			app.vault.offref(modRef);
			app.workspace.offref(openRef);
		};

		const TIME_IN_MS_TO_WAIT_BEFORE_MAKING_CHNAGES_TO_AWOID_RACES = 60;

		const arm = () => {
			clearTimer();
			timeout = window.setTimeout(
				done,
				TIME_IN_MS_TO_WAIT_BEFORE_MAKING_CHNAGES_TO_AWOID_RACES
			);
		};

		// start the timer; any further modify resets it
		arm();

		const modRef = app.vault.on('modify', (f) => {
			if (f instanceof TFile && f.path === file.path) arm();
		});
	});
}
