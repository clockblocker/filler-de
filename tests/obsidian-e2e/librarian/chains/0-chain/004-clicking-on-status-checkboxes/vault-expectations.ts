import { VAULT_EXPECTATIONS_003 } from "../003-create-and-rename-a-file/vault-expectations";

// After test 003, vault has:
// - Berry section: Ingredients, Steps, Renamed scrolls
// - Fish section: Ingredients, Steps scrolls
//
// Test 004 clicks on codex checkboxes to test status propagation:
// Scenario 1: Click one scroll checkbox -> scroll status updates
// Scenario 2: Click all Berry scrolls -> Berry section becomes done
// Scenario 3: Click section checkbox -> all descendants become done
// Scenario 4: Uncheck section -> all descendants become not started

// Re-export base expectations from 003
export const INITIAL_STATE_004 = VAULT_EXPECTATIONS_003.postHealing;

// Scenario 1: After clicking Steps checkbox in Berry codex
// Expected: Steps scroll status changes to Done, codex shows [x] for Steps
// Note: Status is stored as JSON in a hidden section: {"status":"Done"} or {"status":"NotStarted"}
export const CONTENT_CHECKS_004_SCENARIO_1 = {
	// Berry codex should show checked checkbox for Steps
	berryCodexHasStepsChecked: [
		"Library/Recipe/Pie/Berry/__-Berry-Pie-Recipe.md",
		["- [x] [[Steps-Berry-Pie-Recipe|Steps]]"],
	] as const,
	// Steps scroll should have status: Done in the hidden section
	stepsScrollHasStatusDone: [
		"Library/Recipe/Pie/Berry/Steps-Berry-Pie-Recipe.md",
		['"status":"Done"'],
	] as const,
};

// Scenario 2: After clicking all scrolls in Berry (Ingredients, Renamed)
// Expected: All Berry scrolls done, Berry section done in Pie codex
export const CONTENT_CHECKS_004_SCENARIO_2 = {
	// Berry codex shows all scrolls checked
	berryCodexAllChecked: [
		"Library/Recipe/Pie/Berry/__-Berry-Pie-Recipe.md",
		[
			"- [x] [[Ingredients-Berry-Pie-Recipe|Ingredients]]",
			"- [x] [[Steps-Berry-Pie-Recipe|Steps]]",
			"- [x] [[Renamed-Berry-Pie-Recipe|Renamed]]",
		],
	] as const,
	// All scroll files have status: Done
	ingredientsScrollHasStatusDone: [
		"Library/Recipe/Pie/Berry/Ingredients-Berry-Pie-Recipe.md",
		['"status":"Done"'],
	] as const,
	// Pie codex shows Berry section checked (all children done)
	pieCodexHasBerryChecked: [
		"Library/Recipe/Pie/__-Pie-Recipe.md",
		["- [x] [[__-Berry-Pie-Recipe|Berry]]"],
	] as const,
	renamedScrollHasStatusDone: [
		"Library/Recipe/Pie/Berry/Renamed-Berry-Pie-Recipe.md",
		['"status":"Done"'],
	] as const,
};

// Scenario 3: After clicking Fish section checkbox in Pie codex
// Expected: All Fish scrolls become done
export const CONTENT_CHECKS_004_SCENARIO_3 = {
	// Fish codex shows all scrolls checked
	fishCodexAllChecked: [
		"Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
		[
			"- [x] [[Ingredients-Fish-Pie-Recipe|Ingredients]]",
			"- [x] [[Steps-Fish-Pie-Recipe|Steps]]",
		],
	] as const,
	// All Fish scroll files have status: Done
	fishIngredientsHasStatusDone: [
		"Library/Recipe/Pie/Fish/Ingredients-Fish-Pie-Recipe.md",
		['"status":"Done"'],
	] as const,
	fishStepsHasStatusDone: [
		"Library/Recipe/Pie/Fish/Steps-Fish-Pie-Recipe.md",
		['"status":"Done"'],
	] as const,
	// Pie codex shows Fish section checked
	pieCodexHasFishChecked: [
		"Library/Recipe/Pie/__-Pie-Recipe.md",
		["- [x] [[__-Fish-Pie-Recipe|Fish]]"],
	] as const,
};

// Scenario 4: After unchecking Fish section (click again)
// Expected: All Fish scrolls become not started
export const CONTENT_CHECKS_004_SCENARIO_4 = {
	// Fish codex shows all scrolls unchecked
	fishCodexAllUnchecked: [
		"Library/Recipe/Pie/Fish/__-Fish-Pie-Recipe.md",
		[
			"- [ ] [[Ingredients-Fish-Pie-Recipe|Ingredients]]",
			"- [ ] [[Steps-Fish-Pie-Recipe|Steps]]",
		],
	] as const,
	// All Fish scroll files have status: NotStarted
	fishIngredientsHasStatusNotStarted: [
		"Library/Recipe/Pie/Fish/Ingredients-Fish-Pie-Recipe.md",
		['"status":"NotStarted"'],
	] as const,
	fishStepsHasStatusNotStarted: [
		"Library/Recipe/Pie/Fish/Steps-Fish-Pie-Recipe.md",
		['"status":"NotStarted"'],
	] as const,
	// Pie codex shows Fish section unchecked
	pieCodexHasFishUnchecked: [
		"Library/Recipe/Pie/__-Pie-Recipe.md",
		["- [ ] [[__-Fish-Pie-Recipe|Fish]]"],
	] as const,
};

// Helper to convert scenario content checks to PostHealingExpectations format
export function scenarioToContentChecks(
	scenario: Record<string, readonly [string, readonly string[]]>,
): [string, readonly string[]][] {
	return Object.values(scenario).map(([path, lines]) => [path, lines]);
}
