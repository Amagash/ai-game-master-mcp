import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { ConverseTools } from './ConverseTools.js';
import chalk from 'chalk';
import awsClientManager from '../config/aws-client.js';

export class ConverseAgent {
    private modelId: string;
    private region: string;
    private systemPrompt: string;
    private tools: ConverseTools;
    private bedrockClient: BedrockRuntimeClient;

    constructor(modelId: string, region: string, systemPrompt: string) {
        this.modelId = modelId;
        this.region = region;
        this.systemPrompt = systemPrompt;
        this.tools = new ConverseTools();
    }

    /**
     * Initialize the agent with AWS credentials
     */
    public async initialize(): Promise<void> {
        try {
            // Initialize the AWS client manager
            await awsClientManager.initialize();
            
            // Get a Bedrock client for our region
            this.bedrockClient = awsClientManager.getBedrockClient(this.region);
            
            console.log(chalk.green(`ConverseAgent initialized with model ${this.modelId} in region ${this.region}`));
        } catch (error) {
            console.error(chalk.red('Failed to initialize ConverseAgent:'), error);
            throw error;
        }
    }

    /**
     * Set the tools available to this agent
     * @param tools ConverseTools instance
     */
    public setTools(tools: ConverseTools): void {
        this.tools = tools;
    }

    /**
     * Invoke the model with a user prompt
     * @param prompt User input prompt
     * @returns Model response
     */
    public async invokeWithPrompt(prompt: string): Promise<string> {
        try {
            // Ensure we have a Bedrock client
            if (!this.bedrockClient) {
                await this.initialize();
            }

            // Prepare the tools for the model
            const toolsForModel = this.tools.getToolsForModel();
            
            // Build the request payload
            const payload = {
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 8192,
                messages: [
                    {
                        role: 'system',
                        content: this.systemPrompt
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                tools: toolsForModel,
                temperature: 0.7,
                top_p: 0.999
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
            
            // Handle tool calls if present
            if (responseBody.tool_calls && responseBody.tool_calls.length > 0) {
                return await this.handleToolCalls(responseBody.tool_calls, prompt);
            }
            
            // Return the model's response
            return responseBody.content[0].text;
        } catch (error) {
            console.error(chalk.red('Error invoking model:'), error);
            throw error;
        }
    }

    /**
     * Handle tool calls from the model
     * @param toolCalls Array of tool calls from the model
     * @param originalPrompt The original user prompt
     * @returns Final response after tool execution
     */
    private async handleToolCalls(toolCalls: any[], originalPrompt: string): Promise<string> {
        try {
            const toolResults = [];
            
            // Process each tool call
            for (const toolCall of toolCalls) {
                const toolName = toolCall.name;
                const toolInput = JSON.parse(toolCall.parameters);
                
                console.log(chalk.blue(`Executing tool: ${toolName}`));
                
                // Execute the tool
                const result = await this.tools.executeTool(toolName, toolInput);
                
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

            // Invoke the model again with the tool results
            const payload = {
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 8192,
                messages: [
                    {
                        role: 'system',
                        content: this.systemPrompt
                    },
                    {
                        role: 'user',
                        content: toolResultsPrompt
                    }
                ],
                temperature: 0.7,
                top_p: 0.999
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
            console.error(chalk.red('Error handling tool calls:'), error);
            throw error;
        }
    }
}
