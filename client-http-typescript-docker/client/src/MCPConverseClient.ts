import { MCPClient } from './MCPClient.js';
import { serverConfig } from './config/bedrock.js';
import chalk from 'chalk';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import awsClientManager from './config/aws-client.js';

export class MCPConverseClient extends MCPClient {
    private bedrockClient: BedrockRuntimeClient | null = null;
    private modelId: string;
    private region: string;
    private systemPrompt: string;
    private tools: any[] = [];
    private hasAwsCredentials: boolean = false;

    constructor(serverUrl: string = serverConfig.url, apiToken: string = serverConfig.apiToken, modelId: string = 'us.anthropic.claude-3-7-sonnet-20250219-v1:0') {
        super(serverUrl, apiToken);
        this.modelId = modelId;
        this.region = process.env.AWS_REGION || 'us-east-1';
        this.systemPrompt = process.env.BEDROCK_SYSTEM_PROMPT || `You are an AI Game Master 
        for a Dungeons & Dragons campaign. Your job is to guide the players, narrate the world, 
        and respond to their actions as a creative, fair, and entertaining GM. 
        If the player hasn't created their character yet, ask them their name, their race, class and 
        create a character for them using the createCharacter tool. As much as you can, don't 
        assume rules and ask the expert rule if needed. Use the 
        available tools to help you manage the game, resolve actions, and provide information 
        or outcomes. Always strive to make the experience engaging, imaginative, and fun for 
        the players. Be descriptive, inventive, and adapt the story dynamically. Each tool is 
        designed to help you fulfill your role as a game master—use them wisely to enhance 
        the adventure!`;
    }

    async connect(): Promise<void> {
        try {
            // Connect to MCP server first
            try {
                await super.connect();
            } catch (error) {
                console.error(chalk.red('Error connecting to MCP server:'), error);
                console.error(chalk.red('Make sure your API token is correct and the server is accessible'));
                console.error(chalk.red('Current server URL:'), this.serverUrl);
                console.error(chalk.red('Current API token:'), this.apiToken ? '(token provided)' : '(no token)');
                console.log(chalk.yellow('Continuing with limited functionality...'));
                // Don't rethrow, continue with limited functionality
            }
            
            // Initialize AWS credentials and Bedrock client
            this.hasAwsCredentials = await this.initializeBedrockClient();
            
            // Set up tools
            await this.setupTools();
        } catch (error) {
            console.error(chalk.red('Error in MCPConverseClient.connect():'), error);
            console.log(chalk.yellow('Continuing with limited functionality...'));
            // Don't rethrow, continue with limited functionality
        }
    }

    private async initializeBedrockClient(): Promise<boolean> {
        try {
            console.log(chalk.blue(`Initializing Bedrock client in region ${this.region}...`));
            
            // Initialize AWS client manager
            const initialized = await awsClientManager.initialize();
            
            if (initialized) {
                // Get a Bedrock client for our region
                this.bedrockClient = awsClientManager.getBedrockClient(this.region);
                
                if (this.bedrockClient) {
                    console.log(chalk.green('Bedrock client initialized successfully'));
                    return true;
                }
            }
            
            console.log(chalk.yellow('Will use mock responses instead of Bedrock'));
            this.bedrockClient = null;
            return false;
        } catch (error) {
            console.error(chalk.red('Error initializing Bedrock client:'), error);
            console.log(chalk.yellow('Will use mock responses instead of Bedrock'));
            this.bedrockClient = null;
            return false;
        }
    }

    private async setupTools(): Promise<void> {
        try {
            // Fetch available tools from the server
            const tools = await this.getAvailableTools();
            console.log(chalk.cyan('Available Tools:'));
            
            // Store tools for later use with Bedrock
            // Format tools for Claude 3.7
            this.tools = tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                input_schema: {
                    type: 'object',
                    properties: tool.inputSchema.properties || {},
                    required: Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : []
                }
            }));
            
            // Log available tools
            if (tools.length === 0) {
                console.log(chalk.yellow('No tools available from MCP server'));
            } else {
                for (const tool of tools) {
                    console.log(chalk.green(`  • ${tool.name}: `) + tool.description);
                }
            }
            console.log(); // Add blank line for spacing
        } catch (error) {
            console.error(chalk.red('Error setting up tools:'), error);
            console.log(chalk.yellow('Continuing with no tools available'));
            this.tools = [];
        }
    }

    async processUserInput(input: string): Promise<void> {
        try {
            if (!input.trim()) {
                return;
            }
            
            const timestamp = new Date().toLocaleTimeString();
            console.log(chalk.blue(`[${timestamp}] You: `) + input);
            console.log(chalk.yellow('Thinking...'));
            
            const response = await this.invokeWithPrompt(input);
            console.log(chalk.green('Assistant: ') + response);
        } catch (error) {
            console.error(chalk.red('Error: ') + error);
        }
    }

    async invokeWithPrompt(input: string): Promise<string> {
        // If we have AWS credentials and a Bedrock client, use it
        if (this.hasAwsCredentials && this.bedrockClient) {
            try {
                // Build the request payload
                // Build the request payload for Claude 3.7
                const payload = {
                    anthropic_version: "bedrock-2023-05-31",
                    max_tokens: 4096,
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: this.systemPrompt + "\n\n" + input
                                }
                            ]
                        }
                    ],
                    temperature: 0.7,
                    top_p: 0.9,
                    tools: this.tools
                };

                // Create the command
                const command = new InvokeModelCommand({
                    modelId: this.modelId,
                    contentType: 'application/json',
                    accept: 'application/json',
                    body: JSON.stringify(payload)
                });

                // Invoke the model
                console.log(chalk.yellow('Invoking Bedrock model...'));
                const response = await this.bedrockClient.send(command);
                
                // Parse the response
                const responseBody = JSON.parse(new TextDecoder().decode(response.body));
                
                console.log(chalk.blue('Response body:'), JSON.stringify(responseBody, null, 2));
                
                // Handle tool calls if present in Claude 3.7 response format
                if (responseBody.content && responseBody.content.length > 0) {
                    // Check for tool calls in the content
                    for (const contentItem of responseBody.content) {
                        if (contentItem.type === 'tool_use') {
                            console.log(chalk.blue(`Tool call detected: ${contentItem.name}`));
                            return await this.handleToolCalls([{
                                name: contentItem.name,
                                parameters: contentItem.input
                            }], input);
                        }
                    }
                    
                    // If no tool calls, return the text response
                    for (const contentItem of responseBody.content) {
                        if (contentItem.type === 'text') {
                            return contentItem.text;
                        }
                    }
                }
                
                // Handle older Claude format with completion
                if (responseBody.completion) {
                    return responseBody.completion.trim();
                }
                
                console.error(chalk.red('Unexpected response format:'), responseBody);
                return "I received a response in an unexpected format. Please try again.";
            } catch (error) {
                console.error(chalk.red('Error invoking Bedrock model:'), error);
                console.log(chalk.yellow('Falling back to mock responses...'));
                return this.getMockResponse(input);
            }
        } else {
            // Use mock responses if no AWS credentials or Bedrock client
            return this.getMockResponse(input);
        }
    }

    private async handleToolCalls(toolCalls: any[], originalPrompt: string): Promise<string> {
        try {
            const toolResults = [];
            
            // Process each tool call
            for (const toolCall of toolCalls) {
                const toolName = toolCall.name;
                // Check if parameters is already an object or a string that needs parsing
                const toolInput = typeof toolCall.parameters === 'string' 
                    ? JSON.parse(toolCall.parameters) 
                    : toolCall.parameters;
                
                console.log(chalk.blue(`Executing tool: ${toolName}`));
                console.log(chalk.blue(`Tool input: ${JSON.stringify(toolInput)}`));
                
                // Execute the tool using MCP
                const result = await this.callTool(toolName, toolInput);
                
                toolResults.push({
                    tool_name: toolName,
                    tool_input: toolInput,
                    tool_result: result
                });
            }
            
            // Build a new prompt with the tool results
            const toolResultsPrompt = `
I asked: "${originalPrompt}"

The following tools were used:
${toolResults.map(r => `Tool: ${r.tool_name}
Input: ${JSON.stringify(r.tool_input)}
Result: ${JSON.stringify(r.tool_result)}`).join('\n\n')}

Based on these results, please provide a final response.`;

            // If we have AWS credentials and a Bedrock client, use it
            if (this.hasAwsCredentials && this.bedrockClient) {
                try {
                    // Invoke the model again with the tool results
                    // Build the request payload for Claude 3.7
                    const payload = {
                        anthropic_version: "bedrock-2023-05-31",
                        max_tokens: 4096,
                        messages: [
                            {
                                role: "user",
                                content: [
                                    {
                                        type: "text",
                                        text: this.systemPrompt + "\n\n" + toolResultsPrompt
                                    }
                                ]
                            }
                        ],
                        temperature: 0.7,
                        top_p: 0.9,
                        tools: this.tools
                    };

                    // Create the command
                    const command = new InvokeModelCommand({
                        modelId: this.modelId,
                        contentType: 'application/json',
                        accept: 'application/json',
                        body: JSON.stringify(payload)
                    });

                    // Invoke the model
                    console.log(chalk.yellow('Invoking Bedrock model with tool results...'));
                    const response = await this.bedrockClient.send(command);
                    
                    // Parse the response
                    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
                    
                    // Return the model's response
                    return responseBody.content[0].text;
                } catch (error) {
                    console.error(chalk.red('Error invoking Bedrock model with tool results:'), error);
                    // Fall back to a simple response
                    return `I used some tools to help with your request. Here's what I found: ${toolResults.map(r => `For ${r.tool_name}, I got: ${JSON.stringify(r.tool_result)}`).join('. ')}`;
                }
            } else {
                // Fall back to a simple response
                return `I used some tools to help with your request. Here's what I found: ${toolResults.map(r => `For ${r.tool_name}, I got: ${JSON.stringify(r.tool_result)}`).join('. ')}`;
            }
        } catch (error) {
            console.error(chalk.red('Error handling tool calls:'), error);
            return `I tried to use some tools to help with your request, but encountered an error. Let me try to answer directly: ${this.getMockResponse(originalPrompt)}`;
        }
    }

    private getMockResponse(input: string): string {
        // Parse for dice roll commands
        const diceRollRegex = /roll\s+(\d*d\d+)/i;
        const diceMatch = input.match(diceRollRegex);
        
        if (diceMatch) {
            const diceNotation = diceMatch[1];
            const [countStr, sidesStr] = diceNotation.split('d');
            const count = countStr ? parseInt(countStr) : 1;
            const sides = parseInt(sidesStr);
            
            // Generate random rolls
            const rolls = Array.from({ length: count }, () => 
                Math.floor(Math.random() * sides) + 1
            );
            
            // Calculate total
            const total = rolls.reduce((sum, roll) => sum + roll, 0);
            
            if (count === 1) {
                return `You rolled a ${diceNotation} and got: ${total}`;
            } else {
                return `You rolled ${diceNotation} and got: ${rolls.join(', ')} (total: ${total})`;
            }
        }
        
        // Mock responses for testing
        const mockResponses = {
            'hello': 'Greetings, adventurer! Welcome to our magical realm. I am your Game Master. How may I assist you today?',
            'help': 'I can help you create a character, roll dice, answer rule questions, and guide your adventure. What would you like to do?',
            'roll': 'To roll dice, just say something like "roll 2d6" or "roll d20".',
            'create character': 'Let\'s create a character! I\'ll need to know your character\'s name, race, and class. What would you like to name your character?',
            'default': 'I understand your request. Let me think about how to respond to that in our adventure...'
        };
        
        return mockResponses[input.toLowerCase()] || mockResponses.default;
    }
}
