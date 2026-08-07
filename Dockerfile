# Containerised build — the alternative to deploy-vps.sh if you would rather
# not install Node on the box.
#
#   docker compose up -d --build
#
# Builds the site in a throwaway Node stage and serves the result from Caddy,
# so the final image contains no toolchain and no source code.

# --- build ---------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Copy manifests first so this layer is cached until dependencies change.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Tests run as part of the build. A wrong tax rate fails the image build rather
# than reaching the public.
RUN npm run verify

# --- serve ---------------------------------------------------------------
FROM caddy:2-alpine
COPY --from=build /app/dist /srv/dist
COPY Caddyfile.docker /etc/caddy/Caddyfile
EXPOSE 80 443
