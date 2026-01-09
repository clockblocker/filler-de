/// <reference types="@wdio/globals/types" />
import { browser } from "@wdio/globals";

/**
 * Test: Dragging a folder back and forth between parents
 *
 * Structure:
 * Library/dad/kid1/name-kid1-dad.md
 * Library/dad/kid2/name-kid2-dad.md
 * Library/mom/kid3/name-kid3-mom.md
 * Library/mom/kid4/name-kid4-mom.md
 *
 * Action: Drag kid4 between mom and dad 5-6 times
 */

interface FileStructure {
	files: string[];
	codexes: string[];
	regularFiles: string[];
}

async function getLibraryStructure(): Promise<FileStructure> {
	const allFiles = await browser.executeObsidian(async ({ app }) => {
		const result: string[] = [];
		const recurse = (path: string) => {
			const folder = app.vault.getAbstractFileByPath(path);
			if (!folder || !("children" in folder)) return;
			for (const child of (folder as any).children) {
				result.push(child.path);
				if ("children" in child) recurse(child.path);
			}
		};
		recurse("Library");
		return result.sort();
	});

	const codexes = allFiles.filter(f => f.includes("/__-"));
	const regularFiles = allFiles.filter(f => f.endsWith(".md") && !f.includes("/__-"));

	return { codexes, files: allFiles, regularFiles };
}

async function moveFolder(fromPath: string, toPath: string): Promise<void> {
	await browser.executeObsidian(async ({ app }, { from, to }) => {
		const folder = app.vault.getAbstractFileByPath(from);
		if (folder) await app.vault.rename(folder, to);
	}, { from: fromPath, to: toPath });

	// Wait for healing to complete
	await new Promise((r) => setTimeout(r, 3000));
}

export async function testFolderDragCycles(): Promise<void> {
	// console.log("\n=== Starting Folder Drag Cycles Test ===\n");

	// Initial structure
	// console.log("INITIAL STATE:");
	const initial = await getLibraryStructure();
	// console.log("All files:", JSON.stringify(initial.files, null, 2));
	// console.log("\nCodexes:", JSON.stringify(initial.codexes, null, 2));
	// console.log("\nRegular files:", JSON.stringify(initial.regularFiles, null, 2));

	const cycles = 6;

	for (let i = 1; i <= cycles; i++) {
		const isEven = i % 2 === 0;
		const from = isEven ? "Library/dad/kid4" : "Library/mom/kid4";
		const to = isEven ? "Library/mom/kid4" : "Library/dad/kid4";

		// console.log(`\n=== CYCLE ${i}: Moving ${from} -> ${to} ===`);

		await moveFolder(from, to);

		const state = await getLibraryStructure();
		// console.log("\nAll files after cycle", i, ":", JSON.stringify(state.files, null, 2));
		// console.log("\nCodexes:", JSON.stringify(state.codexes, null, 2));
		// console.log("\nRegular files:", JSON.stringify(state.regularFiles, null, 2));

		// Check that kid4 exists at expected location
		const expectedLocation = isEven ? "Library/mom/kid4" : "Library/dad/kid4";
		const kid4Exists = state.files.some(f => f.startsWith(expectedLocation + "/"));
		// console.log(`kid4 exists at ${expectedLocation}:`, kid4Exists);

		// Find all kid4-related files
		const kid4Files = state.files.filter(f => f.includes("kid4"));
		// console.log("\nAll kid4-related files:", JSON.stringify(kid4Files, null, 2));

		// Check suffixes
		const kid4RegularFiles = state.regularFiles.filter(f => f.includes("kid4"));
		const kid4Codexes = state.codexes.filter(f => f.includes("kid4"));

		// console.log("\nkid4 regular files:", JSON.stringify(kid4RegularFiles, null, 2));
		// console.log("kid4 codexes:", JSON.stringify(kid4Codexes, null, 2));

		// Analyze suffix correctness
		for (const file of kid4RegularFiles) {
			const expectedSuffix = isEven ? "-kid4-mom" : "-kid4-dad";
			const hasSuffix = file.includes(expectedSuffix);
			// console.log(`File ${file} has expected suffix ${expectedSuffix}:`, hasSuffix);
		}

		for (const codex of kid4Codexes) {
			const expectedSuffix = isEven ? "__-kid4-mom.md" : "__-kid4-dad.md";
			const hasSuffix = codex.endsWith(expectedSuffix);
			// console.log(`Codex ${codex} has expected suffix ${expectedSuffix}:`, hasSuffix);
		}
	}

	// console.log("\n=== FINAL STATE AFTER ALL CYCLES ===");
	const final = await getLibraryStructure();

	// console.log("\nFinal all files:", JSON.stringify(final.files, null, 2));
	// console.log("\nFinal codexes:", JSON.stringify(final.codexes, null, 2));
	// console.log("\nFinal regular files:", JSON.stringify(final.regularFiles, null, 2));

	// Check for duplicates
	const codexPaths = new Set<string>();
	const duplicateCodexes: string[] = [];
	for (const codex of final.codexes) {
		if (codexPaths.has(codex)) {
			duplicateCodexes.push(codex);
		}
		codexPaths.add(codex);
	}

	if (duplicateCodexes.length > 0) {
		// console.log("\n⚠️  DUPLICATE CODEXES FOUND:", JSON.stringify(duplicateCodexes, null, 2));
	}

	// Check for orphaned codexes (codexes with wrong suffix for their location)
	const orphanedCodexes: string[] = [];
	for (const codex of final.codexes) {
		if (codex.includes("kid4")) {
			const isInMom = codex.startsWith("Library/mom/");
			const isInDad = codex.startsWith("Library/dad/");
			const hasMomSuffix = codex.includes("-mom.md");
			const hasDadSuffix = codex.includes("-dad.md");

			if ((isInMom && !hasMomSuffix) || (isInDad && !hasDadSuffix)) {
				orphanedCodexes.push(codex);
			}
		}
	}

	if (orphanedCodexes.length > 0) {
		// console.log("\n⚠️  ORPHANED CODEXES (wrong suffix for location):", JSON.stringify(orphanedCodexes, null, 2));
	}

	// Check for files with wrong suffixes
	const wrongSuffixFiles: string[] = [];
	for (const file of final.regularFiles) {
		if (file.includes("kid4")) {
			const isInMom = file.startsWith("Library/mom/");
			const isInDad = file.startsWith("Library/dad/");
			const hasMomSuffix = file.includes("-kid4-mom.md");
			const hasDadSuffix = file.includes("-kid4-dad.md");

			if ((isInMom && !hasMomSuffix) || (isInDad && !hasDadSuffix)) {
				wrongSuffixFiles.push(file);
			}
		}
	}

	if (wrongSuffixFiles.length > 0) {
		// console.log("\n⚠️  FILES WITH WRONG SUFFIX:", JSON.stringify(wrongSuffixFiles, null, 2));
	}

	// Final expectation: kid4 should be in dad after 6 cycles
	const kid4Files = final.files.filter(f => f.includes("kid4"));
	const kid4InDad = kid4Files.every(f => f.startsWith("Library/dad/kid4/"));

	// console.log("\n=== FINAL VERIFICATION ===");
	// console.log("All kid4 files in Library/dad/kid4/:", kid4InDad);
	// console.log("kid4 files:", JSON.stringify(kid4Files, null, 2));

	// Don't assert yet, just log for investigation
	// console.log("\n=== Test Complete - Review logs above ===\n");
}
