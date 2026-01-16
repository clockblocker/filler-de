/// <reference types="@wdio/globals/types" />
import { listFilesUnder } from "../../../../support/api/vault-ops";

export async function testPostHealing002(): Promise<void> {
	// Log all files in Library to inspect actual vault state after healing
	const libraryFilesResult = await listFilesUnder("Library");
	if (libraryFilesResult.isErr()) {
		throw new Error(`Failed to list Library files: ${libraryFilesResult.error}`);
	}

	const libraryFiles = libraryFilesResult.value;
	const codexes = libraryFiles.filter((f) => f.includes("/__-"));
	const regularFiles = libraryFiles.filter((f) => !f.includes("/__-"));

	const output = [
		"\n=== POST-HEALING 002 VAULT STATE ===",
		"\n--- CODEXES ---",
		...codexes.sort(),
		"\n--- REGULAR FILES ---",
		...regularFiles.sort(),
		"\n=== END VAULT STATE ===\n",
	].join("\n");

	// Log output via process.stdout for visibility
	process.stdout.write(output);
}
