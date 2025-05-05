import type { ConversationToolConfig, ConversationToolSpec, ToolUseBlock, ToolResultBlock } from './types.js';

interface ToolDefinition {
    function: (name: string, input: any) => Promise<any>;
    description: string;
    inputSchema: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
    };
    originalName: string;
}

export class ConverseTools implements ConversationToolConfig {
    private tools: Record<string, ToolDefinition> = {};
    private nameMapping: Record<string, string> = {};

    private sanitizeName(name: string): string {
        return name.replace(/-/g, '_');
    }

    registerTool(
        name: string,
        func: (name: string, input: any) => Promise<any>,
        description: string,
        inputSchema: {
            type: string;
            properties: Record<string, any>;
            required?: string[];
        }
    ): void {
        const sanitizedName = this.sanitizeName(name);
        console.log(`Registering tool - ${sanitizedName}`);
        
        this.nameMapping[sanitizedName] = name;
        this.tools[sanitizedName] = {
            function: func,
            description,
            inputSchema,
            originalName: name
        };
    }

    getTools(): { tools: ConversationToolSpec[] } {
        const toolSpecs: ConversationToolSpec[] = [];
        
        for (const [sanitizedName, tool] of Object.entries(this.tools)) {
            toolSpecs.push({
                toolSpec: {
                    name: sanitizedName,
                    description: tool.description,
                    inputSchema: {
                        json: tool.inputSchema
                    }
                }
            });
        }

        return { tools: toolSpecs };
    }

    async executeToolAsync(payload: ToolUseBlock): Promise<ToolResultBlock> {
        const { toolUseId, name: sanitizedName, input } = payload;
        console.log(`Executing tool - Requested name: ${sanitizedName}`);

        if (!(sanitizedName in this.tools)) {
            throw new Error(`Unknown tool: ${sanitizedName}`);
        }

        try {
            const tool = this.tools[sanitizedName];
            // Use original name when calling the actual function
            const result = await tool.function(tool.originalName, input);
            // console.log('Tool result:', JSON.stringify(result, null, 2));

            // Handle Bedrock-style content blocks
            if (result?.content?.length > 0) {
                const textContent = result.content.find(item => item.type === 'text');
                if (textContent) {
                    return {
                        toolUseId,
                        content: [{
                            text: textContent.text
                        }],
                        status: 'success'
                    };
                }
            }

            // Fallback for non-content-block results
            const text = typeof result === 'string' ? result : JSON.stringify(result);
            return {
                toolUseId,
                content: [{
                    text
                }],
                status: 'success'
            };
        } catch (error) {
            return {
                toolUseId,
                content: [{
                    text: `Error executing tool: ${error}`
                }],
                status: 'error'
            };
        }
    }

    clearTools(): void {
        this.tools = {};
        this.nameMapping = {};
    }
} 