import type { Backlink } from "../../../prompts/endgame/zod/types";

// plugin: TextEaterPlugin, file: TFile, word: string
export async function synonyms(): Promise<{
	repr: string;
	backlinks: Backlink[];
} | null> {
	// const prompt = promtMakerFromKeyword["Morphems"]();
	// const generatedMorphemAnalysisOutput = await plugin.apiService.generateContent(prompt, word, true)
	// const parsedMorphemAnalysisOutput = morphemAnalysisOutputSchema.safeParse(JSON.parse(generatedMorphemAnalysisOutput));

	// if (parsedMorphemAnalysisOutput.error) {
	//     console.error({zodError: parsedMorphemAnalysisOutput.error, output: generatedMorphemAnalysisOutput});
	//     await plugin.fileService.appendToFile(file.path, "Contact t.me/@clockblocker");
	//     return null;
	// }

	// const morphemAnalysis = parsedMorphemAnalysisOutput.data;
	// const zusammengesetztAusBlock = await getZusammengesetztAusBlock(plugin, file, morphemAnalysis);
	// const morphemischeZerlegungBlock = getMorphemischeZerlegungBlock(morphemAnalysis);

	return await {
		backlinks: [],
		repr: "synonyms",
	};
}
