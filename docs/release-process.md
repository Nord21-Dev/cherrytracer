# Release Process for Newbies 🍒

Welcome to the Cherrytracer release process! We use a "trunk-based" development workflow with **Changesets** to automate versioning, changelogs, and publishing.

This guide will walk you through how to contribute changes and trigger releases without breaking a sweat.

## 1. Making Changes

When you are working on a new feature or fix:

1.  **Create a Branch**: Always start a new branch from `main`.
    ```bash
    git checkout -b my-awesome-feature
    ```
2.  **Write Code**: Make your changes to the codebase.
3.  **Create a Changeset**: If your changes affect any of the following packages, you need to declare it:
    *   `packages/client` (The NPM package)
    *   `apps/api` (The Backend)
    *   `apps/dashboard` (The Frontend)

    Run the following command in the root directory:
    ```bash
    bun run changeset
    ```
    *   **Select Packages**: Use arrow keys and spacebar to select the packages you modified.
    *   **Select SemVer Bump**: Choose `patch` (bug fix), `minor` (new feature), or `major` (breaking change).
    *   **Write Summary**: Write a short, user-facing description of your change. This will end up in the CHANGELOG.

    This command creates a markdown file in `.changeset/`. Commit this file along with your code.

4.  **Push and PR**: Push your branch and open a Pull Request against `main`.

## 2. The Release Lifecycle

Once your PR is merged into `main`, the automation takes over.

### Step A: The "Version Packages" PR
The CI system monitors `main`. If it sees new changesets (those markdown files you added), it will automatically open (or update) a special Pull Request titled **"Version Packages"**.

*   **What it does**: This PR calculates the new versions, updates `package.json` files, and writes to `CHANGELOG.md`.
*   **Action**: When you are ready to release, simply **merge this PR**.

### Step B: The Release Workflow
As soon as the "Version Packages" PR is merged, the **Release** GitHub Action runs on `main`. It only proceeds past publishing if a real release happened.

It performs the following steps automatically:

1.  **Publish via Changesets**: `changesets/action` runs `bun run release`. If there are pending changesets, it publishes the npm package(s) and signals the rest of the workflow that a release occurred. If no publish happened (e.g., only the PR-creation pass), later steps are skipped.
2.  **Detect Version Changes**: A small script diffs the pushed range (`before..sha`) to see which packages bumped versions.
3.  **GitHub Releases**: For each package that changed, it creates a GitHub release using tags like `cherrytracer@1.2.0`, `api@1.2.0`, `dashboard@1.2.0`, pointing at the release commit.
4.  **Publishes to NPM**: Only `packages/client` is published to NPM (driven by Changesets). The app packages stay private.
5.  **Builds Docker Images**:
    *   If `apps/api` changed, it builds and pushes `nord21dev/cherrytracer-api`.
    *   If `apps/dashboard` changed, it builds and pushes `nord21dev/cherrytracer-dashboard`.
    *   Images are tagged with `latest` and the specific version (e.g., `0.1.2`).

## Troubleshooting

### "I merged my PR but no release happened!"
*   Did you add a changeset? If not, the system doesn't know a release is needed.
*   Is the "Version Packages" PR open? You need to merge *that* PR to trigger the actual release.

### "I need to re-run a failed release"
*   Go to the "Actions" tab in GitHub.
*   Select the "Release" workflow.
*   Click "Run workflow" (select `main` branch). This will re-check versions and publish/build anything that is missing.

## Key Commands

| Command | Description |
| :--- | :--- |
| `bun run changeset` | Create a new changeset (do this before committing). |
| `bun run version-packages` | (CI only) Consumes changesets and updates versions. |
| `bun run release` | (CI only) Publishes to NPM and triggers Docker builds. |
