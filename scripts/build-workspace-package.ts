import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

type PackageJson = {
	name?: string;
	exports?: string | Record<string, string>;
};

const packageDir = process.cwd();
const packageJsonPath = path.join(packageDir, "package.json");
const packageJson = JSON.parse(
	readFileSync(packageJsonPath, "utf8"),
) as PackageJson;

const exportValue =
	typeof packageJson.exports === "string"
		? packageJson.exports
		: packageJson.exports?.["."];

if (!exportValue) {
	console.error(`[package-build] No default export entry in ${packageJsonPath}`);
	process.exit(1);
}

const entrypoint = path.resolve(packageDir, exportValue);
const outdir = path.join(packageDir, ".cache", "build");

mkdirSync(outdir, { recursive: true });

console.log(
	`[package-build] ${packageJson.name ?? packageDir} -> ${path.relative(packageDir, outdir)}`,
);

const result = await Bun.build({
	entrypoints: [entrypoint],
	external: ["@codemirror/*", "electron", "obsidian"],
	format: "esm",
	minify: false,
	outdir,
	sourcemap: "linked",
	target: "bun",
});

if (!result.success) {
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

for (const output of result.outputs) {
	console.log(`[package-build] wrote ${path.relative(packageDir, output.path)}`);
}
