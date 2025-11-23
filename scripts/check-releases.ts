import { execSync } from "child_process";
import { readFileSync, existsSync, appendFileSync } from "fs";
import { join } from "path";

const packages = {
    cherrytracer: "packages/client",
    api: "apps/api",
    dashboard: "apps/dashboard",
};

const githubOutput = process.env.GITHUB_OUTPUT;

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

for (const [name, path] of Object.entries(packages)) {
    const pkgPath = join(process.cwd(), path, "package.json");
    if (!existsSync(pkgPath)) {
        console.warn(`Package ${name} not found at ${path}`);
        continue;
    }

    const currentPkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const currentVersion = currentPkg.version;

    // Get previous version from git
    // We assume HEAD~1 is the previous state on main.
    const previousPkgContent = run(`git show HEAD~1:${path}/package.json`);
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
        console.log(`ℹ️ No change in ${name} (Current: ${currentVersion})`);
    }
}
