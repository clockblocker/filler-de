import { describe, expect, it } from "bun:test";
import type { SplitPathToMdFile } from "@textfresser/vault-action-manager/types/split-path";
import { checkEligibility } from "../../../../src/commanders/textfresser/commands/generate/steps/check-eligibility";
import type { CommandState } from "../../../../src/commanders/textfresser/commands/types";

const DUMMY_PATH: SplitPathToMdFile = {
	basename: "Arbeit",
	extension: "md",
	kind: "MdFile",
	pathParts: ["Worter", "de", "lexem", "lemma", "a", "arb", "arbei"],
};

function makeState(content: string): CommandState {
	return {
		actions: [],
		commandContext: {
			activeFile: {
				content,
				splitPath: DUMMY_PATH,
			},
		},
		resultingActions: [],
		textfresserState: {},
	} as unknown as CommandState;
}

describe("checkEligibility", () => {
	it("accepts DictEntry noteKind", () => {
		const content = `---
noteKind: DictEntry
---
body`;
		const result = checkEligibility(makeState(content));
		expect(result.isOk()).toBe(true);
	});

	it("accepts propagation-only structured note with foreign noteKind", () => {
		const content = `---
noteKind: Page
---
## Zusammenarbeit ^LX-LM-NOUN-1

<span class="entry_section_title entry_section_title_morphologie">Morphologische Relationen</span>
Verwendet in:
[[Zusammenarbeit]]`;
		const result = checkEligibility(makeState(content));
		expect(result.isOk()).toBe(true);
	});

	it("rejects non-dict plain notes", () => {
		const content = `---
noteKind: Page
---
regular note body`;
		const result = checkEligibility(makeState(content));
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect("reason" in result.error ? result.error.reason : "").toContain(
				"noteKind: Page",
			);
		}
	});

	it("rejects legacy section-marker stub without entry block id", () => {
		const content = `---
noteKind: Page
---
<span class="entry_section_title entry_section_title_morphologie">Morphologische Relationen</span>
Verwendet in:
[[Zusammenarbeit]]`;
		const result = checkEligibility(makeState(content));
		expect(result.isErr()).toBe(true);
	});
});
