# AI Game Master MCP

This project is an AI-powered Game Master platform using the MCP (Modular Command Protocol) architecture. It features a serverless backend (AWS Lambda, API Gateway, DynamoDB) and a TypeScript client for interactive gameplay, rules queries, and character management.

## Features
- **Ask Rule Expert**: Query an Amazon Bedrock agent for rules, lore, and campaign advice.
- **Character Management**: Create and retrieve characters stored in DynamoDB.
- **Extensible Tools**: Add your own tools for custom game logic.

## Project Structure
```
/ai-game-master-mcp
├── server-http-python-lambda/   # Python AWS Lambda backend (SAM)
├── client-http-typescript-docker/ # TypeScript client
```

## Server Setup (AWS Lambda)

### Prerequisites
- [AWS Account](https://aws.amazon.com/free/?trk=b8f00cc8-e51d-4bfd-bf44-9b5ffb6acd1a&sc_channel=el) with appropriate permissions
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html?trk=b8f00cc8-e51d-4bfd-bf44-9b5ffb6acd1a&sc_channel=el) installed
- [Node.js and npm](https://nodejs.org/) (for the client)
- [Docker](https://docs.docker.com/get-docker/) (for the client)
- [Python 3.9+](https://www.python.org/downloads/)
- Access to [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html?trk=b8f00cc8-e51d-4bfd-bf44-9b5ffb6acd1a&sc_channel=el) in your AWS account
- [Amazon Nova Pro](https://docs.aws.amazon.com/nova/latest/userguide/what-is-nova.html?trk=b8f00cc8-e51d-4bfd-bf44-9b5ffb6acd1a&sc_channel=el) enabled in your Amazon Bedrock model access settings

### Environment Variables
Set these in your deployment or in `template.yaml`:
- `BEDROCK_AGENT_ID`: Your Amazon Bedrock agent ID (NOT auto-created)
- `BEDROCK_AGENT_ALIAS_ID`: Your Bedrock agent alias ID (NOT auto-created)
- `BEDROCK_REGION`: AWS region (default: `us-east-1`)
- `CHARACTER_TABLE`: DynamoDB table for characters (auto-created by SAM template)
- `MCP_SESSION_TABLE`: DynamoDB table for sessions (auto-created)

### Deploying the Server
1. Install dependencies (if needed):
   ```sh
   cd server-http-python-lambda
   uv venv .venv
   source .venv/bin/activate
   uv pip install -r server/requirements.txt
   ```
2. Deploy with SAM:
   ```sh
   sam build
   sam deploy --guided
   ```
   Follow prompts to set environment variables and stack name.

### Lambda Tools Available
- **askRuleExpert**: Ask the Bedrock agent about rules or lore.
- **createCharacter**: Create a new character in DynamoDB.
- **getCharacterByName**: Retrieve a character by name from DynamoDB.
- **diceRoll**: (Core tool) Roll D&D dice (always available).


### Running Tests

To run the Python tests for the server:

1. Navigate to the server directory:
   ```sh
   cd server-http-python-lambda
   ```
2. (Optional) Activate your virtual environment:
   ```sh
   source .venv/bin/activate
   # or
   source venv/bin/activate
   ```
3. Run the tests with pytest:
   ```sh
   pytest
   ```
   For more detailed output:
   ```sh
   pytest -v
   ```

If you don't have pytest installed, you can add it with:
```sh
pip install pytest
```


## Client Setup
1. Go to the client directory:
   ```sh
   cd client-http-typescript-docker
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Run the client:
   ```sh
   ./run-client.sh
   ```
   Configure the client to point to your deployed server's API endpoint.

## Customizing Tools
- Add new tools in `server-http-python-lambda/server/app.py` using the `@mcp_server.tool()` decorator.
- Update the docstring for each tool to set its description and parameter help.

## Development Tips
- Check AWS CloudWatch logs for Lambda debugging.
- Use the `/tools/list` endpoint to see all available tools.
- Use environment variables for all sensitive or environment-specific configuration.
