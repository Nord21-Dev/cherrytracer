# Release process

Cherrytracer now uses trunk-based development with Changesets to automate npm publishing and Docker pushes.

## Day-to-day workflow
- Create a feature branch from `main`.
- When you touch `packages/client`, `apps/api`, or `apps/dashboard`, run `bunx changeset` once and write a short note describing the change (pick patch/minor/major).
- Open a PR; merge to `main` after review.

## What happens on `main`
- `.github/workflows/release.yml` runs on every push to `main`.
- If there are unpublished changesets, it opens/updates a `chore: release` PR.
- When that PR is merged, the workflow:
  - Publishes `cherrytracer` to npm **only if** the client SDK version changed (requires `NPM_TOKEN`).
  - Builds/pushes Docker images **only for the apps whose versions changed**:
    - `apps/api` → `nord21dev/cherrytracer-api:{latest, <api version>}`
    - `apps/dashboard` → `nord21dev/cherrytracer-dashboard:{latest, <dashboard version>}`
    - uses multi-arch builds and needs `DOCKER_USERNAME`/`DOCKER_PASSWORD`.

## Notes
- Use `workflow_dispatch` to retrigger the release pipeline if a publish step needs to be rerun.
