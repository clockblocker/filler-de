/**
 * Just enough of Obsidian's DOM helpers, `Notice`, `Modal` and `Setting`
 * for plugin code that builds a modal: elements hold their children, text,
 * `disabled` and click listeners, and every notice shown is recorded.
 */

/** Every notice shown, oldest first; a test clears it before it acts. */
export const shownNotices: string[] = [];

export class FakeElement {
	readonly children: FakeElement[] = [];
	readonly style: Record<string, unknown> & {
		setProperty: (name: string, value: string) => void;
	} = { setProperty: () => {} };
	textContent = "";
	disabled = false;
	isConnected = true;
	private readonly clicks: (() => void)[] = [];

	constructor(readonly tagName: string) {}

	createEl(tag: string, options: { text?: string } = {}): FakeElement {
		const child = new FakeElement(tag);
		child.textContent = options.text ?? "";
		this.children.push(child);
		return child;
	}

	createDiv(): FakeElement {
		return this.createEl("div");
	}

	setText(text: string): void {
		this.textContent = text;
	}

	empty(): void {
		this.children.length = 0;
	}

	addEventListener(type: string, listener: () => void): void {
		if (type === "click") this.clicks.push(listener);
	}

	click(): void {
		for (const listener of this.clicks) listener();
	}

	querySelectorAll(tag: string): FakeElement[] {
		return this.children.flatMap((child) => [
			...(child.tagName === tag ? [child] : []),
			...child.querySelectorAll(tag),
		]);
	}
}

export class Notice {
	readonly noticeEl = new FakeElement("div");
	constructor(message: string, _duration?: number) {
		shownNotices.push(message);
	}
	setMessage(_message: string): this {
		return this;
	}
	hide(): void {
		this.noticeEl.isConnected = false;
	}
}

export class Modal {
	readonly contentEl = new FakeElement("div");
	constructor(readonly app: unknown) {}
	open(): void {
		this.onOpen();
	}
	close(): void {
		this.onClose();
	}
	onOpen(): void {}
	onClose(): void {}
}

type Dropdown = {
	addOption: (value: string, label: string) => Dropdown;
	setValue: (value: string) => Dropdown;
	onChange: (change: (value: string) => void) => Dropdown;
};

export class Setting {
	constructor(_container: unknown) {}
	setName(_name: string): this {
		return this;
	}
	setDesc(_description: string): this {
		return this;
	}
	addDropdown(build: (dropdown: Dropdown) => void): this {
		const dropdown: Dropdown = {
			addOption: () => dropdown,
			onChange: () => dropdown,
			setValue: () => dropdown,
		};
		build(dropdown);
		return this;
	}
}
