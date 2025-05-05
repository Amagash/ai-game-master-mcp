from lambda_mcp.lambda_mcp import LambdaMCPServer
from datetime import datetime, UTC
import random
import boto3
import os
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

def lambda_handler(event, context):
    """AWS Lambda handler function."""
    return mcp_server.handle_request(event, context) 