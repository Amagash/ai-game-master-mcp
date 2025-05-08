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

# Install Python3 and pip
RUN apk add --no-cache python3 py3-pip

# Create and activate a virtual environment for Python packages
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --upgrade pip
RUN pip install streamlit requests

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built JavaScript from builder stage
COPY --from=build /app/dist ./dist

# Copy Streamlit UI
COPY streamlit-ui ./streamlit-ui

# Set environment variables
ENV NODE_ENV=production
ENV MCP_SSE_URL=http://mcp-server:8000/sse

# Expose Express and Streamlit ports
EXPOSE 8080 8501

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Start both Express and Streamlit
CMD ["/entrypoint.sh"] 