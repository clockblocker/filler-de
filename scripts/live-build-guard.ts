// Refuses to bundle `main.js` into an installed Obsidian plugin folder.
// `build:root` writes `main.js` into the directory it runs in. When that
// directory is a vault's `.obsidian/plugins/<name>`, Hot Reload loads the
// new bundle into that vault at once. `build:root` runs this first, so
// `build`, `dev`, `build:full`, `workspace:build` and `test:obsidian-e2e*`
// all stop there. A checkout nested deeper, such as an agent worktree at
// `<plugin>/.claude/worktrees/<name>`, still builds: only the plugin
// folder itself matches. TEXTFRESSER_ALLOW_LIVE_BUILD=1 builds anyway.
import { realpathSync } from "node:fs";
import path from "node:path";

export const LIVE_BUILD_OVERRIDE = "TEXTFRESSER_ALLOW_LIVE_BUILD";

/** True when `dir` is itself `<vault>/.obsidian/plugins/<name>`. */
export function isInstalledPluginDir(dir: string): boolean {
	const resolved = path.resolve(dir);
	const name = path.basename(resolved);
	const plugins = path.dirname(resolved);
	const configDir = path.dirname(plugins);
	return (
		name !== "" &&
		resolved !== plugins &&
		path.basename(plugins) === "plugins" &&
		path.basename(configDir) === ".obsidian"
	);
}

function realpathOrSelf(dir: string): string {
	try {
		return realpathSync(dir);
	} catch {
		return path.resolve(dir);
	}
}

/**
 * The paths the build directory goes by: `cwd`, its real path, and `PWD`
 * when it names the same directory, so a plugin folder symlinked into a
 * vault and entered through the link also matches.
 */
export function buildDirAliases(cwd: string, pwd: string | undefined): string[] {
	const real = realpathOrSelf(cwd);
	const aliases = new Set([path.resolve(cwd), real]);
	if (pwd && realpathOrSelf(pwd) === real) aliases.add(path.resolve(pwd));
	return [...aliases];
}

/** Why the build must not run here, or undefined when it may. */
export function liveBuildRefusal(
	cwd: string,
	env: Record<string, string | undefined>,
): string | undefined {
	if (env[LIVE_BUILD_OVERRIDE] === "1") return undefined;
	const live = buildDirAliases(cwd, env.PWD).find(isInstalledPluginDir);
	if (!live) return undefined;
	return [
		`Refusing to build main.js into ${live}.`,
		"It is an installed Obsidian plugin folder, so Hot Reload would load this build into the vault.",
		"Build from a worktree outside the vault instead, or set",
		`${LIVE_BUILD_OVERRIDE}=1 to build here anyway.`,
	].join("\n");
}

if (import.meta.main) {
	const refusal = liveBuildRefusal(process.cwd(), process.env);
	if (refusal) {
		console.error(`[live-build-guard] ${refusal}`);
		process.exit(1);
	}
}
