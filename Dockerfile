# Build stage: compile TypeScript to dist/
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Runtime stage: production deps + compiled output
FROM node:20-slim AS runtime
WORKDIR /app

# Install only production dependencies (but keep TS runtime available if build uses it)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy compiled app from build stage
COPY --from=build /app/dist ./dist

# Create directory for config files
RUN mkdir -p /config

# Runtime helper to drop privileges after fixing volume permissions
RUN apt-get update \
  && apt-get install -y --no-install-recommends gosu \
  && rm -rf /var/lib/apt/lists/*

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV GOOGLE_DRIVE_OAUTH_CREDENTIALS=/config/gcp-oauth.keys.json
ENV GOOGLE_DRIVE_MCP_TOKEN_PATH=/config/tokens.json
ENV GOOGLE_DRIVE_MCP_HOST=0.0.0.0
ENV GOOGLE_DRIVE_MCP_PORT=3000

# Streamable HTTP MCP endpoint
EXPOSE 3000

# Make the main script executable
RUN chmod +x dist/index.js

USER root

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
