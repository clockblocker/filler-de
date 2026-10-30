import { describe, expect, it } from "bun:test";
import { withObsidianScenario } from "../harness";
import {
	expectLicenceGroupNotes,
	LICENCE_GROUPS_DUMGEN,
	NUT_PATH,
	NUT_SELECTION,
	PARENT_PATH,
	PARENT_SELECTION,
	STORY,
} from "./classify-licence-groups-script";
import { classifyAndClick } from "./click-links";
import { linkTo } from "./dictionary-layout";

describe("Obsidian E2E - Licence Group tables", () => {
	it("draws one table per Licence Group of Mutter, and each Reading note embeds its own", async () => {
		await withObsidianScenario(
			{
				dumgen: LICENCE_GROUPS_DUMGEN,
				fixture: [{ content: STORY, path: "Story.md" }],
				id: "classify-licence-groups",
				resetDictionary: true,
			},
			async (scenario) => {
				const { dictionary, snapshot, status } = scenario;
				const healed = (await snapshot()).markdown["Story.md"] ?? "";
				expect(healed).toContain(STORY);

				// 👩 Mutter first, then a second sense with another plural, each
				// clicked: the click asks for its Knowledge, so the second sense's
				// licences are judged against the first's stored plural (#281).
				await classifyAndClick(scenario, PARENT_SELECTION);
				expect((await status()).classify?.resolved).toEqual([
					{ linked: 1, readingPath: PARENT_PATH },
				]);
				await classifyAndClick(scenario, NUT_SELECTION);
				expect((await status()).classify?.resolved).toEqual([
					{ linked: 1, readingPath: NUT_PATH },
				]);
				expect((await snapshot()).markdown["Story.md"]).toBe(
					healed.replace(
						STORY,
						`${linkTo(PARENT_PATH, "Die Mutter")} lacht. ^0\n\n${linkTo(NUT_PATH, "Eine Mutter")} klemmt. ^1\n`,
					),
				);

				expectLicenceGroupNotes((await dictionary()).markdown);
				expect((await status()).dumgenRequests?.jev.paradigmLicence).toBe(1);
			},
		);
	});
});
