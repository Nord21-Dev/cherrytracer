# Release process

Cherrytracer now uses trunk-based development with Changesets to automate npm publishing and Docker pushes.

## Day-to-day workflow
- Create a feature branch from `main`.
- If the public client SDK changes, run `bunx changeset` and write a short note describing the change.
- Open a PR; merge to `main` after review.

## What happens on `main`
- `.github/workflows/release.yml` runs on every push to `main`.
- If there are unpublished changesets, it opens/updates a `chore: release` PR.
- When that PR is merged, the workflow:
  - Builds `packages/client` and publishes `cherrytracer` to npm (requires `NPM_TOKEN` secret).
  - Tags Docker images `nord21dev/cherrytracer-api` and `nord21dev/cherrytracer-dashboard` with both `latest` and the published SDK version, pushing multi-arch images via the same workflow (requires `DOCKER_USERNAME` and `DOCKER_PASSWORD`).

## Notes
- The API, Dashboard, and Playground packages are ignored by Changesets so only the public SDK is versioned/published.
- Use `workflow_dispatch` to retrigger the release pipeline if a publish step needs to be rerun.
