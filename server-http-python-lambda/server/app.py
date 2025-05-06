from lambda_mcp.lambda_mcp import LambdaMCPServer
from datetime import datetime, UTC
import random
import boto3
import os
import json
# Get session table name from environment variable
session_table = os.environ.get('MCP_SESSION_TABLE', 'mcp_sessions')

# Create the MCP server instance
mcp_server = LambdaMCPServer(name="mcp-lambda-server", version="1.0.0", session_table=session_table)

@mcp_server.tool()
def get_time() -> str:
    """Get the current UTC date and time."""
    return datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S")

@mcp_server.tool()
def get_weather(city: str) -> str:
    """Get the current weather for a city.
    
    Args:
        city: Name of the city to get weather for
        
    Returns:
        A string describing the weather
    """
    temp = random.randint(15, 35)
    return f"The temperature in {city} is {temp}°C"

@mcp_server.tool()
def count_s3_buckets() -> int:
    """Count the number of S3 buckets."""
    s3 = boto3.client('s3')
    response = s3.list_buckets()
    return len(response['Buckets'])

@mcp_server.tool()
def retrieve_lore(query: str) -> str:
    """Retrieve lore from the Amazon Bedrock agent based on the user's query.
    
    Args:
        query: The user's lore question or search string.
    
    Returns:
        A string containing the retrieved lore or relevant information.
    """
    agent_id = os.environ.get("BEDROCK_AGENT_ID")
    alias_id = os.environ.get("BEDROCK_AGENT_ALIAS_ID")
    region = os.environ.get("BEDROCK_REGION", "us-east-1")

    if not agent_id or not alias_id:
        return "[ERROR] Bedrock agent configuration missing."
    try:
        bedrock = boto3.client("bedrock-agent-runtime", region_name=region)
        response = bedrock.invoke_agent(
            agentId=agent_id,
            agentAliasId=alias_id,
            sessionId="mcp-session",
            inputText=query
        )
        lore = ""
        for event in response["completion"]:
            # Uncomment the next line to debug event structure in CloudWatch logs
            # print(event)
            if "chunk" in event:
                chunk = event["chunk"]
                # If chunk is a dict with 'bytes', decode it
                if isinstance(chunk, dict) and "bytes" in chunk:
                    lore += chunk["bytes"].decode("utf-8")
                # If chunk is already bytes
                elif isinstance(chunk, bytes):
                    lore += chunk.decode("utf-8")
                # If chunk is a string
                elif isinstance(chunk, str):
                    lore += chunk
            elif "text" in event:
                lore += event["text"]
        return lore or "[ERROR] No lore returned from agent."
    except Exception as e:
        return f"[ERROR] Failed to retrieve lore: {str(e)}"

def lambda_handler(event, context):
    """AWS Lambda handler function."""
    return mcp_server.handle_request(event, context) 