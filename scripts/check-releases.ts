import { execSync } from "child_process";
import { readFileSync, existsSync, appendFileSync } from "fs";
import { join } from "path";

const packages = {
    cherrytracer: "packages/client",
    api: "apps/api",
    dashboard: "apps/dashboard",
};

const githubOutput = process.env.GITHUB_OUTPUT;
const gitRangeEnv = (process.env.GIT_RANGE || "").trim();

function run(command: string) {
    try {
        return execSync(command, { encoding: "utf8" }).trim();
    } catch (e) {
        return "";
    }
}

function appendOutput(name: string, value: string) {
    if (githubOutput) {
        appendFileSync(githubOutput, `${name}=${value}\n`);
    } else {
        console.log(`[OUTPUT] ${name}=${value}`);
    }
}

console.log("Checking for release version changes...");
const diffRange =
    gitRangeEnv.includes("..") && !gitRangeEnv.startsWith("..")
        ? gitRangeEnv
        : "HEAD^..HEAD";
console.log(`Using git range: ${diffRange || "(default HEAD^..HEAD)"}`);

for (const [name, path] of Object.entries(packages)) {
    const pkgPath = join(process.cwd(), path, "package.json");
    const relativePkgPath = join(path, "package.json");

    if (!existsSync(pkgPath)) {
        console.warn(`Package ${name} not found at ${path}`);
        continue;
    }

    // Check if package.json changed in the last commit
    const fileChanged = run(
        `git diff --name-only ${diffRange} -- ${relativePkgPath}`,
    );
    if (!fileChanged) {
        console.log(`ℹ️ No file change detected for ${name}`);
        appendOutput(`${name}_changed`, "false");
        // Still output current version for reference
        const currentPkg = JSON.parse(readFileSync(pkgPath, "utf8"));
        appendOutput(`${name}_version`, currentPkg.version);
        continue;
    }

    const currentPkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const currentVersion = currentPkg.version;

    // Get previous version from git
    const previousPkgContent = run(`git show HEAD~1:${relativePkgPath}`);
    let previousVersion = "";
    if (previousPkgContent) {
        try {
            const prevPkg = JSON.parse(previousPkgContent);
            previousVersion = prevPkg.version;
        } catch (e) {
            console.warn(`Failed to parse previous package.json for ${name}`);
        }
    }

    if (currentVersion && currentVersion !== previousVersion) {
        appendOutput(`${name}_changed`, "true");
        appendOutput(`${name}_version`, currentVersion);
        console.log(`✅ Detected change in ${name}: ${previousVersion} -> ${currentVersion}`);
    } else {
        appendOutput(`${name}_changed`, "false");
        appendOutput(`${name}_version`, currentVersion);
        console.log(`ℹ️ File changed but version unchanged in ${name} (Current: ${currentVersion})`);
    }
}
