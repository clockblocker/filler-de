export function cleanMarkdownFormatting(selection: string): string {
	return selection
		.trim()
		.replaceAll("[[", "")
		.replaceAll("]]", "")
		.replaceAll("`", "")
		.replaceAll("=", "")
		.replaceAll("*", "");
}
