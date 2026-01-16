/// <reference types="@wdio/globals/types" />
import { listFilesUnder } from "../../../../support/api/vault-ops";

export async function testPostHealing002(): Promise<void> {
	// Log all files in Library to inspect actual vault state after healing
	const libraryFilesResult = await listFilesUnder("Library");
	if (libraryFilesResult.isErr()) {
		console.error(`Failed to list Library files: ${libraryFilesResult.error}`);
		return;
	}

	const libraryFiles = libraryFilesResult.value;
	const codexes = libraryFiles.filter((f) => f.includes("/__-"));
	const regularFiles = libraryFiles.filter((f) => !f.includes("/__-"));

	console.log("\n=== POST-HEALING 002 VAULT STATE ===");
	console.log("\n--- CODEXES ---");
	for (const codex of codexes.sort()) {
		console.log(codex);
	}
	console.log("\n--- REGULAR FILES ---");
	for (const file of regularFiles.sort()) {
		console.log(file);
	}
	console.log("\n=== END VAULT STATE ===\n");
}
