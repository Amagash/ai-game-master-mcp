from lambda_mcp.lambda_mcp import LambdaMCPServer
import random
import boto3
import os
import json
import uuid
import re
import logging

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

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
    logger.info(f"Calling rule expert with query: {query}")
    agent_id = os.environ.get("BEDROCK_AGENT_ID")
    alias_id = os.environ.get("BEDROCK_AGENT_ALIAS_ID")
    region = os.environ.get("BEDROCK_REGION", "us-east-1")

    if not agent_id or not alias_id:
        logger.error("Bedrock agent configuration missing")
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
            # Log event structure for debugging
            logger.debug(f"Bedrock event: {event}")
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
        logger.info(f"Rule expert response: {lore[:100]}...")
        return lore or "[ERROR] No lore returned from agent."
    except Exception as e:
        logger.error(f"Failed to retrieve lore: {str(e)}", exc_info=True)
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
    logger.info(f"Creating character: {name}, {race}, {character_class}, level {level}")
    table_name = os.environ.get("CHARACTER_TABLE")
    if not table_name:
        logger.error("CHARACTER_TABLE environment variable not set")
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
        logger.info(f"Character created with ID: {character_id}")
        return f"Character created with ID: {character_id}"
    except Exception as e:
        logger.error(f"Failed to create character: {str(e)}", exc_info=True)
        return f"[ERROR] Failed to create character: {str(e)}"

@mcp_server.tool()
def get_character_by_name(name: str) -> str:
    """Retrieve a character all the information about a character by name.
    
    Args:
        name: The character's name to search for.
    
    Returns:
        A JSON string of the character details if found, or an error message.
    """
    logger.info(f"Getting character by name: {name}")
    table_name = os.environ.get("CHARACTER_TABLE")
    if not table_name:
        logger.error("CHARACTER_TABLE environment variable not set")
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
            logger.info(f"No character found with name: {name}")
            return f"[ERROR] No character found with name: {name}"
        # Return the first match as JSON
        logger.info(f"Found character: {items[0]}")
        return json.dumps(items[0], default=str)
    except Exception as e:
        logger.error(f"Failed to retrieve character: {str(e)}", exc_info=True)
        return f"[ERROR] Failed to retrieve character: {str(e)}"

@mcp_server.tool()
def dice_roll(dice_notation: str) -> str:
    """Roll dice using standard D&D notation.
    
    Args:
        dice_notation: Standard dice notation like "2d6", "1d20+5", "3d8-2", etc.
    
    Returns:
        A string with the results of the roll.
    """
    logger.info(f"Rolling dice: {dice_notation}")
    # Parse the dice notation
    pattern = r"(\d+)d(\d+)([+-]\d+)?"
    match = re.match(pattern, dice_notation)
    if not match:
        logger.error(f"Invalid dice notation: {dice_notation}")
        return f"[ERROR] Invalid dice notation: {dice_notation}. Use format like '2d6', '1d20+5', etc."
    
    num_dice = int(match.group(1))
    sides = int(match.group(2))
    modifier = int(match.group(3) or "+0")
    
    if num_dice < 1 or num_dice > 100:
        return "[ERROR] Number of dice must be between 1 and 100."
    if sides < 2 or sides > 1000:
        return "[ERROR] Number of sides must be between 2 and 1000."
    
    # Roll the dice
    rolls = [random.randint(1, sides) for _ in range(num_dice)]
    total = sum(rolls) + modifier
    
    # Format the result
    result = f"Rolled {dice_notation}: {rolls} "
    if modifier != 0:
        sign = "+" if modifier > 0 else ""
        result += f"{sign}{modifier} "
    result += f"= {total}"
    
    logger.info(f"Dice roll result: {result}")
    return result

def lambda_handler(event, context):
    """AWS Lambda handler function."""
    logger.info(f"Received event: {json.dumps(event)}")
    
    # Handle MCP action format (used by client)
    if event.get("body"):
        try:
            body = json.loads(event["body"])
            if isinstance(body, dict) and "action" in body:
                action = body["action"]
                logger.info(f"Handling action: {action}")
                
                # Handle ping action
                if action == "ping":
                    logger.info("Ping received, responding with 204 No Content")
                    return {
                        "statusCode": 204,
                        "headers": {"MCP-Version": "0.6"}
                    }
                
                # Handle listTools action
                if action == "listTools":
                    logger.info("Listing tools")
                    # Override the built-in diceRoll tool with our custom dice_roll tool
                    tools = list(mcp_server.tools.values())
                    
                    # Replace the built-in diceRoll tool with our custom one
                    for i, tool in enumerate(tools):
                        if tool["name"] == "diceRoll":
                            tools[i] = {
                                "name": "diceRoll",
                                "description": "Roll dice using standard D&D notation.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "dice_notation": {
                                            "type": "string", 
                                            "description": "Standard dice notation like '2d6', '1d20+5', '3d8-2', etc."
                                        }
                                    },
                                    "required": ["dice_notation"]
                                }
                            }
                    
                    logger.info(f"Found {len(tools)} tools")
                    return {
                        "statusCode": 200,
                        "headers": {
                            "Content-Type": "application/json",
                            "MCP-Version": "0.6"
                        },
                        "body": json.dumps({"tools": tools})
                    }
                
                # Handle callTool action
                if action == "callTool":
                    tool_name = body.get("name")
                    tool_args = body.get("arguments", {})
                    logger.info(f"Calling tool: {tool_name} with args: {tool_args}")
                    
                    # Special handling for diceRoll with dice_notation parameter
                    if tool_name == "diceRoll" and "dice_notation" in tool_args:
                        try:
                            result = dice_roll(tool_args["dice_notation"])
                            logger.info(f"Dice roll result: {result}")
                            return {
                                "statusCode": 200,
                                "headers": {"Content-Type": "application/json"},
                                "body": json.dumps({"result": result})
                            }
                        except Exception as e:
                            logger.error(f"Error executing dice roll: {str(e)}", exc_info=True)
                            return {
                                "statusCode": 500,
                                "headers": {"Content-Type": "application/json"},
                                "body": json.dumps({"error": f"Error executing dice roll: {str(e)}"})
                            }
                    
                    if tool_name not in mcp_server.tool_implementations:
                        logger.error(f"Tool not found: {tool_name}")
                        return {
                            "statusCode": 404,
                            "headers": {"Content-Type": "application/json"},
                            "body": json.dumps({"error": f"Tool '{tool_name}' not found"})
                        }
                    
                    try:
                        result = mcp_server.tool_implementations[tool_name](**tool_args)
                        logger.info(f"Tool result: {result}")
                        return {
                            "statusCode": 200,
                            "headers": {"Content-Type": "application/json"},
                            "body": json.dumps({"result": result})
                        }
                    except Exception as e:
                        logger.error(f"Error executing tool {tool_name}: {str(e)}", exc_info=True)
                        return {
                            "statusCode": 500,
                            "headers": {"Content-Type": "application/json"},
                            "body": json.dumps({"error": f"Error executing tool: {str(e)}"})
                        }
        except json.JSONDecodeError:
            logger.error("Failed to parse request body as JSON")
    
    # Default to standard MCP handling
    return mcp_server.handle_request(event, context)
