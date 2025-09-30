export const extractBacklinks = (content: string): string[] => {
	const links = content
		.split('[[')
		.map((part) => part.replace(/\\/g, '').split('|')[0].split(']]')[0]);
	links.shift();
	return links;
};

export function makeBacklink({
	fileName,
	linkId,
}: {
	fileName: string;
	linkId: number;
}): string {
	return `*[[${fileName}#^${linkId}|^]]*`;
}

export function parseBacklink(
	formattedBacklink: string
): { fileName: string; linkId: number } | null {
	const match = formattedBacklink.match(
		/\*\[\[([^\[#\|\]]+)#\^(\d+)\|[^\]]*\]\]\*/
	);
	if (!match) return null;
	return {
		fileName: match[1],
		linkId: Number(match[2]),
	};
}

export function wrapTextInBacklinkBlock({
	text,
	fileName,
	linkId,
	prefixWithLink = false,
}: {
	text: string;
	fileName: string;
	linkId: number;
	prefixWithLink?: boolean;
}): string {
	// Strip all newline characters and spaces from the end of the text
	text = text.replace(/[\s\n]+$/, '');

	const formattedBacklink = prefixWithLink
		? makeBacklink({ fileName, linkId })
		: '';
	return `${formattedBacklink} ${text} ^${linkId}\n`;
}
