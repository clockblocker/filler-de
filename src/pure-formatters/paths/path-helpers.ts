import { SLASH } from '../../types/beta/literals';
import { PrettyPath } from '../../types/general';

export function systemPathToPrettyPath(path: string): PrettyPath {
	if (!path || path === '/') return { pathParts: [], title: '' };

	const splitPath = path.split(SLASH).filter(Boolean);

	return {
		title: splitPath.pop() ?? '',
		pathParts: splitPath,
	};
}

export function systemPathToFileFromPrettyPath(prettyPath: PrettyPath) {
	return systemPathFromPrettyPath({ prettyPath, isFile: true });
}

export function systemPathToFolderFromPrettyPath(prettyPath: PrettyPath) {
	return systemPathFromPrettyPath({ prettyPath, isFile: false });
}

export function systemPathFromPrettyPath({
	prettyPath: { pathParts, title },
	isFile,
}: {
	prettyPath: PrettyPath;
	isFile: boolean;
}): string {
	return joinPosix(
		pathToFolderFromPathParts(pathParts),
		safeFileName(title) + (isFile ? '.md' : '')
	);
}

export function safeFileName(s: string): string {
	return s.replace(/[\\/]/g, ' ').trim();
}

export function pathToFolderFromPathParts(pathParts: string[]): string {
	return joinPosix(...pathParts);
}

export function joinPosix(...parts: string[]): string {
	const cleaned = parts
		.filter(Boolean)
		.map((p) => p.replace(/(^[\\/]+)|([\\/]+$)/g, '')) // trim leading/trailing slashes/backslashes
		.filter((p) => p.length > 0);
	return cleaned.join('/');
}
