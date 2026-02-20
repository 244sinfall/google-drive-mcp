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

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled app from build stage
COPY --from=build /app/dist ./dist

# Create directory for config files
RUN mkdir -p /config

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

# Run as non-root user
USER node

# Start the server
ENTRYPOINT ["node", "dist/index.js"]
