# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Build stage
# ---------------------------------------------------------------------------
# --platform=$BUILDPLATFORM: run this stage natively on the builder rather
# than once per target architecture. The output is compiled JS/CSS, which
# is architecture-independent, so emulating arm64 here bought nothing and
# cost hours of QEMU time on the multi-arch build.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Build arguments for React environment variables
ARG REACT_APP_API_BASE_URL=/api
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL

ARG REACT_APP_EXECUTE_TIMEOUT_SECONDS=120
ENV REACT_APP_EXECUTE_TIMEOUT_SECONDS=$REACT_APP_EXECUTE_TIMEOUT_SECONDS

# Build with reduced memory usage
# - Disable source maps (major memory saver, and keeps sources out of the image)
# - Limit Node.js heap
ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN npm run build

# ---------------------------------------------------------------------------
# Production stage — unprivileged nginx (uid 101) listening on 8080.
# Binding a port below 1024 would require root or CAP_NET_BIND_SERVICE.
# ---------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

USER root
# Refresh OS packages so the image does not inherit fixed-but-unpatched CVEs
# (curl/libcurl were flagged HIGH on the previous nginx:alpine build).
RUN apk upgrade --no-cache
USER 101

COPY --from=build /app/build /usr/share/nginx/html

# Custom nginx config to support client-side routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

# busybox wget is already in the base image — no extra package needed.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD ["wget", "--quiet", "--tries=1", "--spider", "http://localhost:8080/"]

CMD ["nginx", "-g", "daemon off;"]
