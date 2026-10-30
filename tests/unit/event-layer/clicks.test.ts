import { describe, expect, it } from "bun:test";
import {
	type PayloadFor,
	UserEventKind,
} from "@textfresser/obsidian-event-layer";
import { Effect } from "effect";
import {
	editorLinkPlace,
	sectionLinkOffset,
} from "../../../src/packages/composed/obsidian-event-layer/src/events/click/wikilink-click/link-offset";
import { onMacOS } from "../../../src/packages/composed/obsidian-event-layer/src/internal/platform";
import {
	eventLayerOn,
	FakeElement,
	fakeApp,
	fakeEditorView,
	fakeEvent,
} from "../../support/event-layer";

const CODEX = "Library/Rezept/__-Rezept.md";

/** A task checkbox on the editor's second line, `- [ ] [[Kuchen]]`. */
function taskCheckbox(checked: boolean) {
	const checkbox = new FakeElement("INPUT", ["task-list-item-checkbox"]);
	checkbox.type = "checkbox";
	checkbox.checked = checked;
	const line = new FakeElement("DIV", ["cm-line"]).append(checkbox);
	new FakeElement("DIV", ["cm-content"]).append(
		new FakeElement("DIV", ["cm-line"]),
		line,
	);
	return checkbox;
}

const LINES = ["# Rezept", "- [ ] [[Kuchen-Rezept|Kuchen]]"];

/** A mousedown, mouseup and click on `target`, as one click. */
function click(
	events: ReturnType<typeof eventLayerOn>,
	target: FakeElement,
	init: Parameters<typeof fakeEvent>[1] = {},
) {
	return ["mousedown", "mouseup", "click"].map((type) =>
		events.fire(fakeEvent(type, { target, ...init })),
	);
}

describe("task checkbox clicks", () => {
	it("a handler that takes the click stops Obsidian's toggle, mousedown to click", () => {
		const events = eventLayerOn(fakeApp(CODEX, { lines: LINES }));
		const seen: PayloadFor<"CheckboxClicked">[] = [];
		events.layer.setHandler(UserEventKind.CheckboxClicked, {
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					seen.push(payload);
					return { outcome: "handled" } as const;
				}),
		});

		const [down, up, done] = click(events, taskCheckbox(false));

		for (const event of [down, up, done]) {
			expect(event?.defaultPrevented).toBe(true);
			expect(event?.immediateStopped).toBe(true);
		}
		expect(seen).toEqual([
			{
				checked: false,
				kind: UserEventKind.CheckboxClicked,
				lineContent: "[[Kuchen-Rezept|Kuchen]]",
				sourcePath: CODEX,
			},
		]);
		expect(events.forks).toEqual([
			{ fork: { traced: true }, kind: UserEventKind.CheckboxClicked },
		]);
	});

	it("one the handler declines, or with no handler, is Obsidian's", () => {
		const events = eventLayerOn(fakeApp(CODEX, { lines: LINES }));
		for (const event of click(events, taskCheckbox(true)))
			expect(event.defaultPrevented).toBe(false);

		events.layer.setHandler(UserEventKind.CheckboxClicked, {
			doesApply: () => false,
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});
		for (const event of click(events, taskCheckbox(true)))
			expect(event.defaultPrevented).toBe(false);
		expect(events.forks).toEqual([]);
	});

	it("ignores any button but the left one", () => {
		const events = eventLayerOn(fakeApp(CODEX, { lines: LINES }));
		events.layer.setHandler(UserEventKind.CheckboxClicked, {
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});
		for (const event of click(events, taskCheckbox(false), { button: 2 }))
			expect(event.defaultPrevented).toBe(false);
		expect(events.forks).toEqual([]);
	});

	it("blocks only the mouseup and click on the handled target", () => {
		const events = eventLayerOn(fakeApp(CODEX, { lines: LINES }));
		events.layer.setHandler(UserEventKind.CheckboxClicked, {
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});
		events.fire(fakeEvent("mousedown", { target: taskCheckbox(false) }));
		const elsewhere = new FakeElement("SPAN");
		expect(
			events.fire(fakeEvent("mouseup", { target: elsewhere }))
				.defaultPrevented,
		).toBe(false);
	});
});

describe("a subscriber that throws", () => {
	/** A task checkbox inside a toolbar button, so two subscribers see it. */
	function checkboxInButton() {
		const checkbox = taskCheckbox(false);
		const line = checkbox.parentElement as FakeElement;
		const button = new FakeElement("DIV").setAttribute(
			"data-action",
			"Translate",
		);
		button.append(line.parentElement as FakeElement);
		return checkbox;
	}

	it("is logged at its kind's edge, and the subscribers after it still run", () => {
		const events = eventLayerOn(fakeApp(CODEX, { lines: LINES }));
		const actions: string[] = [];
		events.layer.setHandler(UserEventKind.CheckboxClicked, {
			doesApply: () => {
				throw new Error("doesApply broke");
			},
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});
		events.layer.setHandler(UserEventKind.ActionElementClicked, {
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					actions.push(payload.actionId);
					return { outcome: "handled" } as const;
				}),
		});

		const [down] = click(events, checkboxInButton());

		expect(down?.defaultPrevented).toBe(false);
		expect(actions).toEqual(["Translate"]);
		expect(events.forks.map(({ kind }) => kind)).toEqual([
			UserEventKind.CheckboxClicked,
			UserEventKind.ActionElementClicked,
		]);
		expect(events.failures.map(String).join()).toContain("doesApply broke");
	});

	it("leaves a mousedown another subscriber handled blocked to its click", () => {
		const events = eventLayerOn(fakeApp(CODEX, { lines: LINES }));
		events.layer.setHandler(UserEventKind.CheckboxClicked, {
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});
		events.layer.setHandler(UserEventKind.ActionElementClicked, {
			doesApply: () => {
				throw new Error("doesApply broke");
			},
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});

		const [down, up, done] = click(events, checkboxInButton());

		expect(down?.defaultPrevented).toBe(true);
		expect(up?.defaultPrevented).toBe(true);
		expect(done?.defaultPrevented).toBe(true);
	});
});

describe("frontmatter checkbox clicks", () => {
	it("tell the handler, and leave the toggle to Obsidian", () => {
		const input = new FakeElement("INPUT");
		input.type = "checkbox";
		input.checked = true;
		const key = new FakeElement("DIV", ["metadata-property-key"]);
		key.textContent = " done ";
		new FakeElement("DIV", ["metadata-container"]).append(
			new FakeElement("DIV", ["metadata-property"]).append(key, input),
		);
		const events = eventLayerOn(fakeApp(CODEX));
		const seen: PayloadFor<"CheckboxFrontmatterClicked">[] = [];
		events.layer.setHandler(UserEventKind.CheckboxFrontmatterClicked, {
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					seen.push(payload);
					return { outcome: "handled" } as const;
				}),
		});

		const [down] = click(events, input);

		expect(down?.defaultPrevented).toBe(false);
		expect(seen).toEqual([
			{
				checked: true,
				kind: UserEventKind.CheckboxFrontmatterClicked,
				propertyName: "done",
				sourcePath: CODEX,
			},
		]);
	});
});

/** A link in reading mode, `[[Worter/f/fah/fahre/fahrer|Fahrer]]`. */
function readingLink() {
	const link = new FakeElement("A", ["internal-link"]).setAttribute(
		"data-href",
		"Worter/f/fah/fahre/fahrer",
	);
	link.textContent = "Fahrer";
	const paragraph = new FakeElement("P").append(link);
	paragraph.textContent = "Der Fahrer fährt.";
	return link;
}

describe("wikilink clicks", () => {
	it("a passthrough opens the link as Obsidian would, then runs the handler's afterwards", () => {
		const events = eventLayerOn(fakeApp("Library/Story.md"));
		const order: string[] = [];
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			afterwards: (payload) =>
				Effect.sync(() => {
					order.push(
						`afterwards ${payload.target.basename}, opened ${events.opened.length}`,
					);
				}),
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					order.push(`handle ${payload.target.alias}`);
					return { outcome: "passthrough" } as const;
				}),
		});

		const [down, up, done] = click(events, readingLink());

		expect(down?.defaultPrevented).toBe(true);
		expect(up?.defaultPrevented).toBe(true);
		expect(done?.defaultPrevented).toBe(true);
		expect(events.opened).toEqual([
			{ sourcePath: "Library/Story.md", target: "Worter/f/fah/fahre/fahrer" },
		]);
		expect(order).toEqual([
			"handle Fahrer",
			"afterwards Worter/f/fah/fahre/fahrer, opened 1",
		]);
	});

	it("runs the handler's afterwards even when the link fails to open, and fails at the edge", () => {
		const events = eventLayerOn(fakeApp("Library/Story.md"), {
			openLinkFails: true,
		});
		const reopened: string[] = [];
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			afterwards: (payload) =>
				Effect.sync(() => {
					reopened.push(payload.target.basename);
				}),
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "passthrough" } as const),
		});

		click(events, readingLink());

		expect(reopened).toEqual(["Worter/f/fah/fahre/fahrer"]);
		expect(events.failures.map(String).join()).toContain(
			"no Worter/f/fah/fahre/fahrer",
		);
	});

	it("a handled click opens nothing", () => {
		const events = eventLayerOn(fakeApp("Library/Story.md"));
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "handled" } as const),
		});
		click(events, readingLink());
		expect(events.opened).toEqual([]);
	});

	it("leaves a click with a modifier to Obsidian, for a new tab", () => {
		const events = eventLayerOn(fakeApp("Library/Story.md"));
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			doesApply: () => true,
			handle: () => Effect.succeed({ outcome: "passthrough" } as const),
		});
		for (const event of click(events, readingLink(), { metaKey: true }))
			expect(event.defaultPrevented).toBe(false);
		expect(events.opened).toEqual([]);
		expect(events.forks).toEqual([]);
	});
});

describe("action element clicks and selection changes", () => {
	it("run untraced: a button's command opens its own root, and a selection change is frequent", () => {
		const events = eventLayerOn(
			fakeApp("Library/Story.md", { selection: "Fahrer" }),
		);
		const told: string[] = [];
		events.layer.setHandler(UserEventKind.ActionElementClicked, {
			doesApply: (payload) => payload.actionId === "Translate",
			handle: (payload) =>
				Effect.sync(() => {
					told.push(payload.actionId);
					return { outcome: "handled" } as const;
				}),
		});
		events.layer.setHandler(UserEventKind.SelectionChanged, {
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					told.push(`${payload.source}: ${payload.selectedText}`);
					return { outcome: "passthrough" } as const;
				}),
		});
		const button = new FakeElement("BUTTON").setAttribute(
			"data-action",
			"Translate",
		);
		const disabled = new FakeElement("BUTTON")
			.setAttribute("data-action", "Translate")
			.setAttribute("disabled", "");

		click(events, button);
		click(events, disabled);
		events.fire(fakeEvent("mouseup", { target: new FakeElement("SPAN") }));
		events.fire(fakeEvent("keyup", { key: "ArrowLeft", shiftKey: true }));
		events.fire(fakeEvent("keyup", { key: "x" }));
		events.fire(fakeEvent("dragend"));

		// A mouseup on a button is its click, not a selection.
		expect(told).toEqual([
			"Translate",
			"mouse: Fahrer",
			"keyboard: Fahrer",
			"drag: Fahrer",
		]);
		expect(new Set(events.forks.map(({ fork }) => fork.traced))).toEqual(
			new Set([false]),
		);
	});
});

describe("wikilink click offsets", () => {
	const STORY = "Library/Story.md";

	const TEXT = [
		"# Story",
		"",
		"Der `[[Code]]` [[Worter/m/man/mann/mann|Mann]] %%[[Kommentar]]%% ![[Bild.png]] [Web](https://x.de) und",
		"der [[Worter/f/fah/fahre/fahrer|Fahrer]]. ^0",
	].join("\n");

	/** Reading view's section of `TEXT`'s lines 2 to 3, with its two links. */
	function readingSection() {
		const mann = new FakeElement("A", ["internal-link"]).setAttribute(
			"data-href",
			"Worter/m/man/mann/mann",
		);
		const fahrer = new FakeElement("A", ["internal-link"]).setAttribute(
			"data-href",
			"Worter/f/fah/fahre/fahrer",
		);
		fahrer.textContent = "Fahrer";
		const embedded = new FakeElement("A", ["internal-link"]).setAttribute(
			"data-href",
			"Elsewhere",
		);
		const embed = new FakeElement("SPAN", ["internal-embed"]).append(embedded);
		const section = new FakeElement("DIV").append(
			new FakeElement("P").append(mann, embed, fahrer),
		);
		return { embedded, fahrer, section };
	}

	const clickedOffsets = (
		events: ReturnType<typeof eventLayerOn>,
		target: FakeElement,
	) => {
		const told: (number | undefined)[] = [];
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					told.push(payload.offset);
					return { outcome: "handled" } as const;
				}),
		});
		click(events, target);
		return told;
	};

	it("tells where a Reading view link stands from its section's lines and its place among the section's links", () => {
		const events = eventLayerOn(fakeApp(STORY, { mode: "preview" }));
		const { fahrer, section } = readingSection();
		events.renderSection(section, { lineEnd: 3, lineStart: 2, sourcePath: STORY, text: TEXT });
		const [offset] = clickedOffsets(events, fahrer);
		expect(offset).toBe(TEXT.indexOf("[[Worter/f/fah") + 2);
	});

	it("tells a link in a section of another note, such as a split pane's, as that note's", () => {
		const events = eventLayerOn(fakeApp(STORY, { mode: "preview" }));
		const { fahrer, section } = readingSection();
		events.renderSection(section, {
			lineEnd: 3,
			lineStart: 2,
			sourcePath: "Library/Other.md",
			text: TEXT,
		});
		const told: { offset?: number; sourcePath: string }[] = [];
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			doesApply: () => true,
			handle: ({ offset, sourcePath }) =>
				Effect.sync(() => {
					told.push({ ...(offset === undefined ? {} : { offset }), sourcePath });
					return { outcome: "handled" } as const;
				}),
		});
		click(events, fahrer);
		expect(told).toEqual([
			{ offset: TEXT.indexOf("[[Worter/f/fah") + 2, sourcePath: "Library/Other.md" },
		]);
	});

	it("tells nothing for a link in an embed, an unrendered section, or one whose source disagrees", () => {
		const embedded = eventLayerOn(fakeApp(STORY, { mode: "preview" }));
		const first = readingSection();
		embedded.renderSection(first.section, { lineEnd: 3, lineStart: 2, sourcePath: STORY, text: TEXT });
		expect(clickedOffsets(embedded, first.embedded)).toEqual([undefined]);

		const unrendered = eventLayerOn(fakeApp(STORY, { mode: "preview" }));
		expect(clickedOffsets(unrendered, readingSection().fahrer)).toEqual([undefined]);

		const stale = eventLayerOn(fakeApp(STORY, { mode: "preview" }));
		const third = readingSection();
		stale.renderSection(third.section, {
			lineEnd: 3,
			lineStart: 2,
			sourcePath: STORY,
			text: TEXT.replace("Worter/f/fah/fahre/fahrer", "Worter/f/fah/fahre/fahrerin"),
		});
		expect(clickedOffsets(stale, third.fahrer)).toEqual([undefined]);
	});
});

describe("editorLinkPlace", () => {
	const NOTE = "# Story\n\nDer [[Worter/f/fah/fahre/fahrer|Fahrer]] fährt. ^0\n";
	const AT = NOTE.indexOf("Fahrer]]");

	/** An editor of `doc` holding `link`, which CodeMirror places at `at`. */
	function editorOf(doc: string, link: FakeElement, at: number) {
		const dom = new FakeElement("DIV", ["cm-editor"]);
		const view = {
			posAtDOM: (node: unknown) => {
				if (node !== link && !dom.contains(node as FakeElement))
					throw new RangeError("outside the document");
				return at;
			},
			state: fakeEditorView(doc).state,
		};
		return { dom, view };
	}

	const linkElement = () => {
		const link = new FakeElement("SPAN", ["cm-hmd-internal-link"]);
		link.textContent = "Fahrer";
		return link;
	};

	/** The workspace's panes: `Library/Story.md`'s holds `pane`, another note's holds `other`. */
	const workspaceOf = (pane: FakeElement, other?: FakeElement) =>
		({
			workspace: {
				iterateAllLeaves: (each: (leaf: unknown) => void) => {
					if (other) each({ view: { containerEl: other, file: { path: "Library/Other.md" } } });
					each({ view: { containerEl: pane, file: { path: "Library/Story.md" } } });
				},
			},
		}) as never;

	const placeOf = (
		link: FakeElement,
		views: Map<FakeElement, unknown>,
		pane: FakeElement | undefined = [...views.keys()].at(-1),
	) =>
		editorLinkPlace(
			workspaceOf(pane ?? new FakeElement("DIV")),
			link as unknown as HTMLElement,
			(dom) => (views.get(dom as unknown as FakeElement) ?? null) as never,
		);
	const offsetOf = (link: FakeElement, views: Map<FakeElement, unknown>) =>
		placeOf(link, views)?.offset;

	it("tells a link of a split pane as that pane's note's, with its target from that note's text", () => {
		const link = linkElement();
		const { dom, view } = editorOf(NOTE, link, AT);
		dom.append(link);
		const active = new FakeElement("DIV");
		const pane = new FakeElement("DIV").append(dom);
		expect(
			editorLinkPlace(
				workspaceOf(active, pane),
				link as unknown as HTMLElement,
				(editor) => (editor === (dom as unknown) ? view : null) as never,
			),
		).toEqual({
			offset: AT,
			sourcePath: "Library/Other.md",
			target: { alias: "Fahrer", basename: "Worter/f/fah/fahre/fahrer" },
		});
		// A link in no pane, such as a hover preview's, has no place.
		expect(
			editorLinkPlace(
				workspaceOf(active),
				link as unknown as HTMLElement,
				(editor) => (editor === (dom as unknown) ? view : null) as never,
			),
		).toBeUndefined();
	});

	it("reads the offset from the view the link belongs to, in any pane, not from its rendered line", () => {
		const link = linkElement();
		const { dom, view } = editorOf(NOTE, link, AT);
		dom.append(new FakeElement("DIV", ["cm-content"]).append(new FakeElement("DIV", ["cm-line"]).append(link)));
		expect(offsetOf(link, new Map([[dom, view]]))).toBe(AT);
	});

	it("tells nothing where no link spans the position, or the element is in no editor", () => {
		const link = linkElement();
		const { dom, view } = editorOf(NOTE, link, NOTE.indexOf("fährt"));
		dom.append(link);
		expect(offsetOf(link, new Map([[dom, view]]))).toBeUndefined();
		expect(offsetOf(linkElement(), new Map())).toBeUndefined();
	});

	it("moves a table cell's offset into the note, where its text stands there once", () => {
		const table = "| Wer | Was |\n| --- | --- |\n| [[Worter/f/fah/fahre/fahrer\\|Fahrer]] | fährt |";
		const note = `# Story\n\n${table}\n\nDanach.\n`;
		const cellText = "[[Worter/f/fah/fahre/fahrer\\|Fahrer]]";
		const link = linkElement();
		const cell = editorOf(cellText, link, cellText.indexOf("Fahrer]]"));
		cell.dom.append(link);
		const outer = editorOf(note, cell.dom, note.indexOf("| Wer"));
		outer.dom.append(new FakeElement("DIV", ["cm-table-widget"]).append(cell.dom));
		const views = new Map<FakeElement, unknown>([
			[cell.dom, cell.view],
			[outer.dom, outer.view],
		]);
		expect(offsetOf(link, views)).toBe(note.indexOf("Fahrer]]"));

		// The same cell twice in the table: which one is not known.
		const twice = `# Story\n\n${table}\n${table.split("\n")[2]}\n`;
		const ambiguous = editorOf(twice, cell.dom, twice.indexOf("| Wer"));
		const again = new FakeElement("DIV", ["cm-editor"]);
		again.append(new FakeElement("DIV").append(cell.dom));
		expect(
			offsetOf(link, new Map<FakeElement, unknown>([[cell.dom, cell.view], [again, ambiguous.view]])),
		).toBeUndefined();
	});
});

describe("sectionLinkOffset", () => {
	it("counts the links Reading view renders as internal links, and only those", () => {
		const text = [
			"```",
			"[[InCode]]",
			"```",
			"A `x [[Inline]] x` %%[[Hidden]]%% <!-- [[Html]] --> ![[Embed]] ![alt](pic.png) [web](https://x.de)",
			"[[First|1]] [md [with] brackets](Notes/Second%20One.md) [![img](pic.png)](Third) [[Fourth\\|4]]",
		].join("\n");
		const hrefs = ["First", "Notes/Second One.md", "Third", "Fourth"];
		expect([0, 1, 2, 3, 4].map((index) => sectionLinkOffset(text, 0, 4, index, hrefs))).toEqual([
			text.indexOf("[[First") + 2,
			text.indexOf("[md [with]") + 1,
			text.indexOf("[![img]") + 1,
			text.indexOf("[[Fourth") + 2,
			undefined,
		]);
		// Lines the note does not have.
		expect(sectionLinkOffset(text, 3, 9, 0, hrefs)).toBeUndefined();
	});

	it("tells nothing unless the source's links and the rendered ones agree one for one", () => {
		const text = "[[A]] [[B]] [[C]]";
		expect(sectionLinkOffset(text, 0, 0, 1, ["A", "B", "C"])).toBe(text.indexOf("[[B") + 2);
		expect(sectionLinkOffset(text, 0, 0, 1, ["A", "B"])).toBeUndefined();
		expect(sectionLinkOffset(text, 0, 0, 1, ["A", "X", "C"])).toBeUndefined();
		// A Markdown link this reading misparses renders a link it does not see.
		expect(sectionLinkOffset("[a](b c d) [[B]]", 0, 0, 0, ["b c d", "B"])).toBeUndefined();
	});

	it("reads only the section's own lines", () => {
		const text = "[[A]]\n\n[[B]] [[C]]\n\n[[D]]";
		expect(sectionLinkOffset(text, 2, 2, 1, ["B", "C"])).toBe(text.indexOf("[[C]]") + 2);
	});
});

describe("observed wikilink clicks", () => {
	function observing() {
		const events = eventLayerOn(fakeApp("Library/Story.md"));
		const clicked: string[] = [];
		const observed: PayloadFor<"WikilinkObserved">[] = [];
		events.layer.setHandler(UserEventKind.WikilinkClicked, {
			doesApply: () => true,
			handle: (payload) =>
				Effect.sync(() => {
					clicked.push(payload.target.basename);
					return { outcome: "handled" } as const;
				}),
		});
		events.layer.setHandler(UserEventKind.WikilinkObserved, {
			doesApply: () => true,
			// Whatever it answers, Obsidian navigates.
			handle: (payload) =>
				Effect.sync(() => {
					observed.push(payload);
					return { outcome: "handled" } as const;
				}),
		});
		return { clicked, events, observed };
	}

	// The platform's modifier, and the key that is not one here.
	const mod = onMacOS() ? { metaKey: true } : { ctrlKey: true };
	const notMod = onMacOS() ? { ctrlKey: true } : { metaKey: true };

	it("tells a click with the platform's modifier or a middle click to its handler, and leaves the navigation to Obsidian", () => {
		for (const init of [mod, { button: 1 }, { button: 1, shiftKey: true }]) {
			const { clicked, events, observed } = observing();
			for (const event of click(events, readingLink(), init))
				expect(event.defaultPrevented).toBe(false);
			expect(clicked).toEqual([]);
			expect(events.opened).toEqual([]);
			expect(observed.map(({ kind, sourcePath, target }) => ({ kind, sourcePath, target }))).toEqual([
				{
					kind: UserEventKind.WikilinkObserved,
					sourcePath: "Library/Story.md",
					target: { alias: "Fahrer", basename: "Worter/f/fah/fahre/fahrer" },
				},
			]);
			expect(events.forks).toEqual([
				{ fork: { traced: true }, kind: UserEventKind.WikilinkObserved },
			]);
		}
	});

	it("leaves the other key's click alone, such as Ctrl-click's context menu on macOS", () => {
		const { clicked, events, observed } = observing();
		for (const event of click(events, readingLink(), notMod))
			expect(event.defaultPrevented).toBe(false);
		expect([...clicked, ...observed]).toEqual([]);
	});

	it("observes no plain click, nor one with only Shift or Alt, nor a right click", () => {
		const plain = observing();
		click(plain.events, readingLink());
		expect(plain.clicked).toEqual(["Worter/f/fah/fahre/fahrer"]);
		expect(plain.observed).toEqual([]);

		for (const init of [{ shiftKey: true }, { altKey: true }, { button: 2 }]) {
			const { clicked, events, observed } = observing();
			for (const event of click(events, readingLink(), init))
				expect(event.defaultPrevented).toBe(false);
			expect([...clicked, ...observed]).toEqual([]);
		}
	});
});
