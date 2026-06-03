# syntax=docker/dockerfile:1
#
# Docker here wraps the build / preview / deploy TOOLCHAIN — Forge is serverless,
# so this is not an app runtime. Multi-stage:
#   deps      → install root + frontend deps (cached on lockfiles)
#   build     → produce frontend/dist
#   toolchain → final image the preview / forge ops run from
#
# Node is pinned to the manifest runtime (nodejs22.x) so host, container and
# Forge prod all agree.
ARG NODE_VERSION=22

# --- deps: install dependencies, cached on the lockfiles alone ---------------
FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
# Root toolchain deps (includes @forge/cli). Manifests first → the npm ci layer
# is reused as long as the lockfile is unchanged. (E2E runs on the host, not in
# this image — Playwright's browser isn't installed here.)
COPY package.json package-lock.json ./
RUN npm ci
# Frontend deps (separate package + lockfile; not an npm workspace).
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm --prefix frontend ci

# --- build: compile the frontend into frontend/dist --------------------------
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm --prefix frontend run build

# --- toolchain: source + deps + built assets; runs preview / forge ops -------
FROM deps AS toolchain
WORKDIR /app
COPY . .
# Carry the built assets so `forge deploy` can bundle them without rebuilding.
COPY --from=build /app/frontend/dist ./frontend/dist
EXPOSE 5173
# Default service is the zero-setup mock preview (mock data, no Jira, no auth).
CMD ["npm", "--prefix", "frontend", "run", "dev:mock"]
