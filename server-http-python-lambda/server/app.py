from lambda_mcp.lambda_mcp import LambdaMCPServer
import random
import boto3
import os
import json
import uuid
# Get session table name from environment variable
session_table = os.environ.get('MCP_SESSION_TABLE', 'mcp_sessions')

# Create the MCP server instance
mcp_server = LambdaMCPServer(name="mcp-lambda-server", version="1.0.0", session_table=session_table)

@mcp_server.tool()
def ask_rule_expert(query: str) -> str:
    """Call an agent expert in the rules and lore of the game. 
    Refer to the agent expert for game mechanics, anything about the universe, 
    campaign creation and more to make a decision about the game.
    
    Args:
        query: The AI game master question about rules
    
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

@mcp_server.tool()
def create_character(name: str, race: str, character_class: str, level: int = 1) -> str:
    """Create a new character and store it in DynamoDB.
    
    Args:
        name: The character's name.
        race: The character's race.
        character_class: The character's class.
        level: The character's starting level (default 1).
    
    Returns:
        A string with the new character's ID and a success message.
    """
    table_name = os.environ.get("CHARACTER_TABLE")
    if not table_name:
        return "[ERROR] CHARACTER_TABLE environment variable not set."
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)
    character_id = str(uuid.uuid4())
    item = {
        "character_id": character_id,
        "name": name,
        "race": race,
        "character_class": character_class,
        "level": level
    }
    try:
        table.put_item(Item=item)
        return f"Character created with ID: {character_id}"
    except Exception as e:
        return f"[ERROR] Failed to create character: {str(e)}"

@mcp_server.tool()
def get_character_by_name(name: str) -> str:
    """Retrieve a character all the information about a character by name.
    
    Args:
        name: The character's name to search for.
    
    Returns:
        A JSON string of the character details if found, or an error message.
    """
    table_name = os.environ.get("CHARACTER_TABLE")
    if not table_name:
        return "[ERROR] CHARACTER_TABLE environment variable not set."
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(table_name)
    try:
        # Scan for the character by name (not efficient for large tables)
        response = table.scan(
            FilterExpression=boto3.dynamodb.conditions.Attr("name").eq(name)
        )
        items = response.get("Items", [])
        if not items:
            return f"[ERROR] No character found with name: {name}"
        # Return the first match as JSON
        return json.dumps(items[0], default=str)
    except Exception as e:
        return f"[ERROR] Failed to retrieve character: {str(e)}"

def lambda_handler(event, context):
    """AWS Lambda handler function."""
    return mcp_server.handle_request(event, context) 