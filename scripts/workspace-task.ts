import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

type Task = "build" | "build-full" | "install";

type PackageInfo = {
	dir: string;
	name: string;
	relativeDir: string;
	scripts: Record<string, string>;
};

type RootPackageJson = {
	workspaces?: string[];
};

const [, , taskArg, ...restArgs] = process.argv;
const task = taskArg as Task | undefined;
const dryRun = restArgs.includes("--dry-run");

if (task !== "build" && task !== "build-full" && task !== "install") {
	console.error(
		"Usage: bun ./scripts/workspace-task.ts <build|build-full|install> [--dry-run]",
	);
	process.exit(1);
}

const repoRoot = findRepoRoot(process.cwd());
if (!repoRoot) {
	console.error("[workspace-task] Could not find repo root from current directory.");
	process.exit(1);
}

const packages = listWorkspacePackages(repoRoot);
const packageForCwd = findOwningPackage(process.cwd(), packages);

if (packageForCwd) {
	await runPackageTask(packageForCwd, task, dryRun);
	process.exit(0);
}

for (const pkg of packages) {
	await runPackageTask(pkg, task, dryRun);
}

await runRootTask(task, repoRoot, dryRun);

function findRepoRoot(startDir: string): string | null {
	let current = path.resolve(startDir);

	while (true) {
		const packageJsonPath = path.join(current, "package.json");
		if (existsSync(packageJsonPath)) {
			const packageJson = JSON.parse(
				readFileSync(packageJsonPath, "utf8"),
			) as RootPackageJson;
			if (Array.isArray(packageJson.workspaces)) {
				return current;
			}
		}

		const parent = path.dirname(current);
		if (parent === current) {
			return null;
		}
		current = parent;
	}
}

function listWorkspacePackages(repoRoot: string): PackageInfo[] {
	const packagesRoot = path.join(repoRoot, "src", "packages");
	const groups = readdirSync(packagesRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	const packages: PackageInfo[] = [];

	for (const group of groups) {
		const groupDir = path.join(packagesRoot, group);
		const entries = readdirSync(groupDir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort();

		for (const entry of entries) {
			const packageDir = path.join(groupDir, entry);
			const packageJsonPath = path.join(packageDir, "package.json");
			if (!existsSync(packageJsonPath)) {
				continue;
			}

			const packageJson = JSON.parse(
				readFileSync(packageJsonPath, "utf8"),
			) as {
				name?: string;
				scripts?: Record<string, string>;
			};

			packages.push({
				dir: packageDir,
				name: packageJson.name ?? entry,
				relativeDir: path.relative(repoRoot, packageDir),
				scripts: packageJson.scripts ?? {},
			});
		}
	}

	return packages;
}

function findOwningPackage(
	cwd: string,
	packages: readonly PackageInfo[],
): PackageInfo | undefined {
	const normalizedCwd = path.resolve(cwd);
	return packages.find((pkg) => {
		const pkgDir = path.resolve(pkg.dir);
		return normalizedCwd === pkgDir || normalizedCwd.startsWith(`${pkgDir}${path.sep}`);
	});
}

async function runPackageTask(
	pkg: PackageInfo,
	task: Task,
	dryRun: boolean,
): Promise<void> {
	if (task === "build" || task === "build-full") {
		const scriptName = task === "build-full" ? "build:full" : "build";
		if (!pkg.scripts[scriptName]) {
			if (task === "build-full" && pkg.scripts.build) {
				await runCommand(
					"bun",
					["run", "build"],
					pkg.dir,
					dryRun,
					pkg.relativeDir,
				);
				return;
			}
			console.log(`\n==> [${pkg.relativeDir}] skip ${scriptName} (no ${scriptName} script)`);
			return;
		}
		await runCommand(
			"bun",
			["run", scriptName],
			pkg.dir,
			dryRun,
			pkg.relativeDir,
		);
		return;
	}

	await runCommand("bun", ["install"], pkg.dir, dryRun, pkg.relativeDir);
}

async function runRootTask(
	task: Task,
	repoRoot: string,
	dryRun: boolean,
): Promise<void> {
	if (task === "build") {
		await runCommand("bun", ["run", "build:root"], repoRoot, dryRun, ".");
		return;
	}

	if (task === "build-full") {
		await runCommand("bun", ["run", "build:full"], repoRoot, dryRun, ".");
		return;
	}

	await runCommand("bun", ["install"], repoRoot, dryRun, ".");
}

async function runCommand(
	command: string,
	args: string[],
	cwd: string,
	dryRun: boolean,
	label: string,
): Promise<void> {
	console.log(`\n==> [${label}] ${command} ${args.join(" ")}`);
	if (dryRun) {
		return;
	}

	const proc = Bun.spawn([command, ...args], {
		cwd,
		stdio: ["inherit", "inherit", "inherit"],
	});

	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		process.exit(exitCode);
	}
}
