export type CliResult = {
	stdout: string;
	stderr: string;
	exitCode: number;
};

export type PostHealingExpectations = {
	codexes: readonly string[];
	files: readonly string[];
	goneFiles?: readonly string[];
	contentChecks?: readonly [path: string, expectedLines: readonly string[]][];
	contentMustNotContain?: readonly [path: string, forbiddenLines: readonly string[]][];
};
