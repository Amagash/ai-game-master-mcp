# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm install

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built JavaScript from builder stage
COPY --from=build /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV MCP_SSE_URL=http://mcp-server:8000/sse

# Start the app
CMD ["node", "dist/index.js"] 