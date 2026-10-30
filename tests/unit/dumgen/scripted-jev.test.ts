import { describe, expect, it } from "bun:test";
import type { Answer } from "dumgen";
import { createScriptedJev } from "../../../src/managers/dumgen/scripted-jev";

const picked = (choice: string): Answer => ({
	choice,
	confidence: 1,
	probabilities: { [choice]: 1 },
	type: "choice",
});

/** A question for the scripted jev: a Noul, or a Choice over `options`. */
const noul = { instructions: "?", type: "noul" } as const;
const choiceOver = (...options: string[]) =>
	({
		criteria: Object.fromEntries(options.map((option) => [option, option])),
		instructions: "?",
		type: "choice",
	}) as const;

describe("The scripted jev", () => {
	it("answers `<stage>:<id>` only in its stage, over a bare `<id>`", async () => {
		const jev = createScriptedJev({
			"breakdown-forms:f_1": picked("f0"),
			f_2: { noul: 0.9, type: "noul" },
		});
		const ask = (stage: string, questions: Record<string, unknown>) =>
			jev.ask(
				{ model: "jev", questions, state: {} } as never,
				{ signal: new AbortController().signal, stage },
			);

		// In `candidates`, f_1 is a Noul the script leaves to the default.
		expect(
			(await ask("candidates", { f_1: noul, f_2: noul })).answers,
		).toEqual({
			f_1: { noul: 0.1, type: "noul" },
			f_2: { noul: 0.9, type: "noul" },
		});
		// In `breakdown-forms`, f_1 is the headword Choice the script picks.
		expect(
			(
				await ask("breakdown-forms", {
					f_0: choiceOver("f0", "f1"),
					f_1: choiceOver("f0", "f1"),
				})
			).answers,
		).toEqual({ f_0: picked("f1"), f_1: picked("f0") });
		expect(jev.requests()).toEqual({ "breakdown-forms": 1, candidates: 1 });
	});
});
