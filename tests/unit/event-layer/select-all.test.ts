import { describe, expect, it } from "bun:test";
import { UserEventKind } from "@textfresser/obsidian-event-layer";
import { createSelectAllHandler } from "../../../src/managers/obsidian/behavior-manager/select-all-behavior";
import { scrollBodyRange } from "../../../src/stateless-helpers/scroll-body-range";
import {
	eventLayerOn,
	FakeElement,
	fakeApp,
	fakeEditorView,
	fakeEvent,
} from "../../support/event-layer";

const NOTE = "Library/Märchen/Aschenputtel-Märchen.md";
const SCROLL = "[[__-Märchen|← Märchen]]\nEs war einmal.\nUnd dann.";

/** Bun reports macOS, so select-all is Cmd+A. */
const selectAll = (init: Parameters<typeof fakeEvent>[1] = {}) =>
	fakeEvent("keydown", { key: "a", metaKey: true, ...init });

function layerOver(
	content: string,
	options: { readonly mode?: "source" | "preview" } = {},
) {
	const cm = fakeEditorView(content, 0);
	const events = eventLayerOn(fakeApp(NOTE, { cm, mode: options.mode }));
	events.layer.setHandler(UserEventKind.SelectAll, createSelectAllHandler());
	const selection = () => {
		const { anchor, head } = cm.state.selection.main;
		return { from: anchor, to: head };
	};
	return { cm, events, selection };
}

describe("select-all", () => {
	it("selects a Scroll's body, without its go-back link, inside the event", () => {
		const { events, selection } = layerOver(SCROLL);
		const event = events.fire(selectAll());

		expect(event.defaultPrevented).toBe(true);
		expect(event.propagationStopped).toBe(true);
		expect(selection()).toEqual(scrollBodyRange(SCROLL));
		expect(SCROLL.slice(selection().from, selection().to)).toBe(
			"Es war einmal.\nUnd dann.",
		);
		expect(events.forks).toEqual([
			{ fork: { traced: true }, kind: UserEventKind.SelectAll },
		]);
	});

	it("leaves a note with nothing to exclude to the native select-all", () => {
		const { events, selection } = layerOver("Es war einmal.");
		const event = events.fire(selectAll());

		expect(event.defaultPrevented).toBe(false);
		expect(selection()).toEqual({ from: 0, to: 0 });
		expect(events.forks).toEqual([]);
	});

	it("is not select-all with Ctrl on macOS, with Shift, or for another key", () => {
		const { events } = layerOver(SCROLL);
		for (const init of [
			{ ctrlKey: true, metaKey: false },
			{ shiftKey: true },
			{ key: "b" },
		])
			expect(events.fire(selectAll(init)).defaultPrevented).toBe(false);
		expect(events.forks).toEqual([]);
	});

	it("leaves the note's title, and the reading view, alone", () => {
		const title = layerOver(SCROLL);
		title.events.state.activeElement = new FakeElement("DIV", [
			"inline-title",
		]);
		expect(title.events.fire(selectAll()).defaultPrevented).toBe(false);

		const reading = layerOver(SCROLL, { mode: "preview" });
		expect(reading.events.fire(selectAll()).defaultPrevented).toBe(false);
	});
});
