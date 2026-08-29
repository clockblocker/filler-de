import { expect } from "bun:test";
import { fileExists, readFile } from "../../../../utils";
import {
	TARGET_ASCHENPUTTEL_HEALED_PAGE_PATH,
	TARGET_ASCHENPUTTEL_RAW_PAGE_PATH,
} from "./vault-expectations";

const LEMMA_LINK_PATTERN = /reichen\s+\[\[(?:[^\]|]+\|)?Manne\]\],\s+dem/;

export async function testPostHealing010(): Promise<void> {
	const path = (await fileExists(TARGET_ASCHENPUTTEL_RAW_PAGE_PATH))
		? TARGET_ASCHENPUTTEL_RAW_PAGE_PATH
		: TARGET_ASCHENPUTTEL_HEALED_PAGE_PATH;
	const startedAt = Date.now();
	let content = await readFile(path);
	while (!LEMMA_LINK_PATTERN.test(content) && Date.now() - startedAt < 8_000) {
		await new Promise((resolve) => setTimeout(resolve, 200));
		content = await readFile(path);
	}
	expect(content).toMatch(LEMMA_LINK_PATTERN);
}
