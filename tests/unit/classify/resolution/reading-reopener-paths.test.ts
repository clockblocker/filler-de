import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { createReadingReopener } from "../../../../src/commanders/classify/resolution/scroll-to-reading";

const NFC = "Worter/de/Lexeme/NOUN/Fem/m/müt/mütte/\u{1F469} Mütter";
const NFD = NFC.normalize("NFD");

function reopener(active: string | null) {
	const awaited: string[] = [];
	const opened: string[] = [];
	const reopenEffect = createReadingReopener({
		activePath: Effect.succeed(active),
		open: (path) =>
			Effect.sync(() => {
				opened.push(path);
			}),
		queue: {
			awaitNote: async (path) => {
				awaited.push(path);
				return true;
			},
		},
	});
	const reopen = (target: string) => Effect.runPromise(reopenEffect(target));
	return { awaited, opened, reopen };
}

describe("createReadingReopener path identity", () => {
	it("does not reopen the active note when the link spells it in NFD", async () => {
		const { opened, reopen } = reopener(`${NFC}.md`);
		expect(await reopen(`${NFD}|Mütter`)).toBe(false);
		expect(opened).toEqual([]);
	});

	it("waits only for links below Worter/, case-sensitively", async () => {
		const { awaited, reopen } = reopener(null);
		expect(await reopen("worter/x|x")).toBe(false);
		expect(await reopen("Worterbuch/x|x")).toBe(false);
		expect(awaited).toEqual([]);
	});
});
