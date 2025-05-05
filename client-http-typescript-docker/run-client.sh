#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting MCP Client..."

# Config file for storing MCP URL and API Key
CONFIG_FILE=".mcp-config"
API_TOKEN_FILE=".mcp-api-token"
HASH_FILE=".docker-build-hash"

# Function to read MCP URL from config file
get_saved_mcp_url() {
    if [ -f "$CONFIG_FILE" ]; then
        cat "$CONFIG_FILE"
    fi
}

# Function to read MCP API Key from config file
get_saved_api_token() {
    if [ -f "$API_TOKEN_FILE" ]; then
        cat "$API_TOKEN_FILE"
    fi
}

# Function to calculate hash of Dockerfile and source code
calculate_build_hash() {
    find ./client -type f \( -name "Dockerfile" -o -path "*/src/*" \) -exec sha256sum {} \; | sort | sha256sum | cut -d' ' -f1
}

# Get saved MCP URL if it exists
SAVED_MCP_URL=$(get_saved_mcp_url)

# Get saved API Key if it exists
SAVED_API_TOKEN=$(get_saved_api_token)

# Prompt for MCP URL with default if available
if [ -n "$SAVED_MCP_URL" ]; then
    read -p "Enter MCP server URL (press Enter to use saved: $SAVED_MCP_URL): " MCP_URL
    MCP_URL=${MCP_URL:-$SAVED_MCP_URL}
else
    read -p "Enter MCP server URL: " MCP_URL
fi

# Prompt for MCP API Key with default if available
if [ -n "$SAVED_API_TOKEN" ]; then
    read -p "Enter MCP Auth token (press Enter to use saved token): " MCP_TOKEN
    MCP_TOKEN=${MCP_TOKEN:-$SAVED_API_TOKEN}
else
    read -p "Enter MCP API Token: " MCP_TOKEN
fi

# Save the URL for next time
echo "$MCP_URL" > "$CONFIG_FILE"

# Save the API Key for next time
echo "$MCP_TOKEN" > "$API_TOKEN_FILE"

echo "📦 Getting AWS credentials from your current session..."

# Get the current role being used and verify AWS access
CURRENT_ROLE=$(aws sts get-caller-identity --query 'Arn' --output text)
if [ $? -ne 0 ]; then
    echo "❌ Failed to get AWS credentials. Please check your AWS configuration."
    exit 1
fi
echo "🔑 Using AWS Role: $CURRENT_ROLE"

# Get credentials from current session
echo "🔄 Getting AWS credentials..."
CREDS=$(aws configure export-credentials)
if [ $? -ne 0 ]; then
    echo "❌ Failed to export AWS credentials"
    exit 1
fi

# Extract credentials
AWS_ACCESS_KEY_ID=$(echo "$CREDS" | jq -r '.AccessKeyId')
AWS_SECRET_ACCESS_KEY=$(echo "$CREDS" | jq -r '.SecretAccessKey')
AWS_SESSION_TOKEN=$(echo "$CREDS" | jq -r '.SessionToken')
AWS_REGION=$(aws configure get region)

if [ -z "$AWS_REGION" ]; then
    AWS_REGION="us-west-2"
    echo "⚠️  No AWS region found in config, defaulting to $AWS_REGION"
else
    echo "✅ Using region: $AWS_REGION"
fi

# Calculate current hash
CURRENT_HASH=$(calculate_build_hash)
STORED_HASH=""
if [ -f "$HASH_FILE" ]; then
    STORED_HASH=$(cat "$HASH_FILE")
fi

# Build the container if hash has changed or doesn't exist
if [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
    echo "🏗️  Changes detected, rebuilding the client container..."
    docker build -t mcp-client ./client
    echo "$CURRENT_HASH" > "$HASH_FILE"
else
    echo "✅ No changes detected, using existing container"
fi

# Run the container
echo "🚀 Running the client container..."
docker run -it \
    -e AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
    -e AWS_SESSION_TOKEN="$AWS_SESSION_TOKEN" \
    -e AWS_REGION="$AWS_REGION" \
    -e NODE_ENV=development \
    -e MCP_URL="$MCP_URL" \
    -e MCP_TOKEN="$MCP_TOKEN" \
    -v "$(pwd)/client/src:/app/src" \
    mcp-client 