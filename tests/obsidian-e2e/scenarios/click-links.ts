/**
 * Classify attests nothing and asks no Knowledge: a click on a unit's link
 * does both (#281). Scenarios that expect an Attestation or Knowledge
 * classify, then click.
 */
import type { withObsidianScenario } from "../harness";
import { linkpath } from "./dictionary-layout";

type Scenario = Parameters<Parameters<typeof withObsidianScenario>[1]>[0];

/**
 * Runs Classify on `selection` in the Scroll at `path`, then clicks every
 * link to each Reading it resolved, through real mouse events: each click
 * attests its occurrence, one already attested adds nothing, and act()
 * waits for the Knowledge the click asks for. Answers what Classify
 * resolved.
 */
export async function classifyAndClick(
	{ act, snapshot, status }: Pick<Scenario, "act" | "snapshot" | "status">,
	selection: string,
	path = "Story.md",
) {
	await act({ kind: "runClassify", path, selection });
	const resolved = (await status()).classify?.resolved ?? [];
	for (const unit of resolved) {
		if (!("readingPath" in unit)) continue;
		const target = linkpath(unit.readingPath);
		const scroll = (await snapshot()).markdown[path] ?? "";
		const links = scroll.split(`[[${target}|`).length - 1;
		for (let nth = 0; nth < links; nth++)
			await act({ kind: "clickScrollLink", linkpath: target, nth, path });
	}
	return resolved;
}
