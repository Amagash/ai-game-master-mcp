import { ConverseAgent } from './converse/ConverseAgent.js';
import { ConverseTools } from './converse/ConverseTools.js';
import { MCPClient } from './MCPClient.js';
import { bedrockConfig, serverConfig } from './config/bedrock.js';
import chalk from 'chalk';

export class MCPConverseClient extends MCPClient {
    private converseAgent: ConverseAgent;
    private converseTools: ConverseTools;

    constructor(serverUrl: string = serverConfig.url, apiToken: string = serverConfig.apiToken, modelId: string = bedrockConfig.modelId) {
        super(serverUrl, apiToken);
        this.converseAgent = new ConverseAgent(modelId, bedrockConfig.region, bedrockConfig.systemPrompt);
        this.converseTools = new ConverseTools();
    }

    async connect(): Promise<void> {
        await super.connect();
        await this.setupTools();
    }

    private async setupTools(): Promise<void> {
        try {
            // Fetch available tools from the server
            const tools = await this.getAvailableTools();
            console.log(chalk.cyan('Available Tools:'));
            
            // Register each tool
            for (const tool of tools) {
                const schema = {
                    type: tool.inputSchema.type || 'object',
                    properties: tool.inputSchema.properties || {},
                    required: Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : []
                };
                
                this.converseTools.registerTool(
                    tool.name,
                    async (name: string, input: any) => {
                        return await this.callTool(name, input);
                    },
                    tool.description,
                    schema
                );
                console.log(chalk.green(`  • ${tool.name}: `) + tool.description);
            }
            console.log(); // Add blank line for spacing

            // Set the tools in the converse agent
            this.converseAgent.setTools(this.converseTools);
        } catch (error) {
            console.error(chalk.red('Error setting up tools:'), error);
            throw error;
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
            
            const response = await this.converseAgent.invokeWithPrompt(input);
            console.log(chalk.green('Assistant: ') + response);
        } catch (error) {
            console.error(chalk.red('Error: ') + error);
        }
    }
} 