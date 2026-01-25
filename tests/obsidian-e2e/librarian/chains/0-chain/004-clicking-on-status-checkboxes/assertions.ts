/// <reference types="@wdio/globals/types" />
import { createTestContext } from "../../../../support/api";
import { HEALING_POLL_OPTIONS } from "../../../../support/config";
import {
	CONTENT_CHECKS_004_SCENARIO_1,
	CONTENT_CHECKS_004_SCENARIO_2,
	CONTENT_CHECKS_004_SCENARIO_3,
	CONTENT_CHECKS_004_SCENARIO_4,
	scenarioToContentChecks,
} from "./vault-expectations";

// Minimal file lists for checkbox tests - only check files we're asserting content on
const BERRY_CODEX_AND_SCROLLS = [
	"Library/Recipe/Pie/Berry/__-Berry-Pie-Recipe.md",
	"Library/Recipe/Pie/Berry/Steps-Berry-Pie-Recipe.md",
	"Library/Recipe/Pie/Berry/Ingredients-Berry-Pie-Recipe.md",
	"Library/Recipe/Pie/Berry/Renamed-Berry-Pie-Recipe.md",
];

const PIE_AND_FISH_FILES = [
	"Library/Recipe/Pie/__-Pie-Recipe.md",
	"Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
	"Library/Recipe/Pie/Fish/Ingredients-Fish-Pie-Recipe.md",
	"Library/Recipe/Pie/Fish/Steps-Fish-Pie-Recipe.md",
];

/**
 * Scenario 1: After clicking Steps checkbox in Berry codex.
 * Verifies:
 * - Steps scroll has status: true
 * - Berry codex shows [x] for Steps
 */
export async function testPostHealing004_scenario1(): Promise<void> {
	const t = createTestContext("testPostHealing004_scenario1");
	await t.gatherDebug("Library/Recipe/Pie/Berry");
	await t.expectPostHealing(
		{
			codexes: [],
			contentChecks: scenarioToContentChecks(CONTENT_CHECKS_004_SCENARIO_1),
			files: BERRY_CODEX_AND_SCROLLS,
		},
		{
			...HEALING_POLL_OPTIONS,
			logFolderOnFail: "Library/Recipe/Pie/Berry",
		},
	);
}

/**
 * Scenario 2: After clicking all scroll checkboxes in Berry.
 * Verifies:
 * - All Berry scrolls have status: true
 * - Berry codex shows [x] for all scrolls
 * - Pie codex shows [x] for Berry section (all children done)
 */
export async function testPostHealing004_scenario2(): Promise<void> {
	const t = createTestContext("testPostHealing004_scenario2");
	await t.gatherDebug("Library/Recipe/Pie");
	await t.expectPostHealing(
		{
			codexes: [],
			contentChecks: scenarioToContentChecks(CONTENT_CHECKS_004_SCENARIO_2),
			files: [...BERRY_CODEX_AND_SCROLLS, "Library/Recipe/Pie/__-Pie-Recipe.md"],
		},
		{
			...HEALING_POLL_OPTIONS,
			logFolderOnFail: "Library/Recipe/Pie",
		},
	);
}

/**
 * Scenario 3: After clicking Fish section checkbox in Pie codex.
 * Verifies:
 * - All Fish scrolls have status: true
 * - Fish codex shows [x] for all scrolls
 * - Pie codex shows [x] for Fish section
 */
export async function testPostHealing004_scenario3(): Promise<void> {
	const t = createTestContext("testPostHealing004_scenario3");
	await t.gatherDebug("Library/Recipe/Pie");
	await t.expectPostHealing(
		{
			codexes: [],
			contentChecks: scenarioToContentChecks(CONTENT_CHECKS_004_SCENARIO_3),
			files: PIE_AND_FISH_FILES,
		},
		{
			...HEALING_POLL_OPTIONS,
			logFolderOnFail: "Library/Recipe/Pie",
		},
	);
}

/**
 * Scenario 4: After unchecking Fish section (clicking again).
 * Verifies:
 * - All Fish scrolls have status: false
 * - Fish codex shows [ ] for all scrolls
 * - Pie codex shows [ ] for Fish section
 */
export async function testPostHealing004_scenario4(): Promise<void> {
	const t = createTestContext("testPostHealing004_scenario4");
	await t.gatherDebug("Library/Recipe/Pie");
	await t.expectPostHealing(
		{
			codexes: [],
			contentChecks: scenarioToContentChecks(CONTENT_CHECKS_004_SCENARIO_4),
			files: PIE_AND_FISH_FILES,
		},
		{
			...HEALING_POLL_OPTIONS,
			logFolderOnFail: "Library/Recipe/Pie",
		},
	);
}
