export type BlockExtract = {
	blockName: string; // e.g. "buttons"
	outerHTML: string; // full <span>…</span>
	innerHTML: string; // inside contents
	textContent: string; // plain text
};

export class BlockManager {
	private parse(html: string): Document {
		const parser = new DOMParser();
		return parser.parseFromString(html, 'text/html');
	}

	/** Build the CSS selector for a given blockName */
	private selector(blockName: string): string {
		// blockName should be simple; if you expect weird chars, consider CSS.escape
		return `span.note_block.note_block_${blockName}`;
	}

	/**
	 * Extract contents from `<span class="note_block note_block_{blockName}">...</span>`
	 * Returns all matches (there can be multiple blocks in the string).
	 */
	extractContents(html: string, blockName: string): BlockExtract[] {
		const doc = this.parse(html);
		const nodes = Array.from(
			doc.body.querySelectorAll(this.selector(blockName))
		) as HTMLSpanElement[];

		return nodes.map((el) => ({
			blockName,
			outerHTML: el.outerHTML,
			innerHTML: el.innerHTML,
			textContent: el.textContent ?? '',
		}));
	}

	/**
	 * Wrap a given HTML string in the block span:
	 * <span class="note_block note_block_{blockName}">{content}</span>
	 */
	wrap(
		contentHTML: string,
		blockName: string,
		extraClasses: string[] = []
	): string {
		const classes = [
			'note_block',
			`note_block_${blockName}`,
			...extraClasses,
		].join(' ');
		return `<span class="${classes}">${contentHTML}</span>`;
	}

	/**
	 * Ensure the string is wrapped once. If it already has the outer span for this block,
	 * returns the original string; otherwise wraps it.
	 */
	ensureWrapped(
		contentOrBlockHTML: string,
		blockName: string,
		extraClasses: string[] = []
	): string {
		const doc = this.parse(contentOrBlockHTML);
		const root = doc.body.firstElementChild;

		if (
			root &&
			root.tagName.toLowerCase() === 'span' &&
			root.classList.contains('note_block') &&
			root.classList.contains(`note_block_${blockName}`)
		) {
			return contentOrBlockHTML; // already wrapped
		}
		return this.wrap(contentOrBlockHTML, blockName, extraClasses);
	}

	/**
	 * Replace ALL blocks of a given name with a transformer over their INNER HTML.
	 * Handy if you want to inject buttons or tweak content.
	 */
	transformBlocks(
		html: string,
		blockName: string,
		transform: (innerHTML: string, el: HTMLSpanElement) => string
	): string {
		const doc = this.parse(html);
		const nodes = Array.from(
			doc.body.querySelectorAll(this.selector(blockName))
		) as HTMLSpanElement[];
		nodes.forEach((el) => {
			const nextInner = transform(el.innerHTML, el);
			el.innerHTML = nextInner;
		});
		return doc.body.innerHTML;
	}

	/** Extract all note_block spans of any type */
	extractAllBlocks(html: string): BlockExtract[] {
		const doc = this.parse(html);

		console.log('doc', doc);
		const nodes = Array.from(
			doc.body.querySelectorAll('span.note_block')
		) as HTMLSpanElement[];

		return nodes.map((el) => {
			// find the note_block_* part
			const nameClass = Array.from(el.classList).find((c) =>
				c.startsWith('note_block_')
			);
			const blockName = nameClass ? nameClass.replace('note_block_', '') : '';
			return {
				blockName,
				outerHTML: el.outerHTML,
				innerHTML: el.innerHTML,
				textContent: el.textContent ?? '',
			};
		});
	}
}
