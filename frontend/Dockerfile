# Build stage
FROM node:18-alpine AS build
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Build with reduced memory usage
# - Disable source maps (major memory saver)
# - Limit Node.js heap to 1.5GB
ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS="--max-old-space-size=1536"
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom nginx config to support client-side routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
