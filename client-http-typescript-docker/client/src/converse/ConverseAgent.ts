import { BedrockRuntimeClient, ConverseCommand, type Message, type ContentBlock, type ToolUseBlock, type ToolResultBlock } from "@aws-sdk/client-bedrock-runtime";
import { ConversationStopReason } from './types.js';
import type { ConversationToolConfig } from './types.js';
import { bedrockConfig } from '../config/bedrock.js';

export class ConverseAgent {
    private client: BedrockRuntimeClient;
    private messages: Message[];
    private tools?: ConversationToolConfig;
    private responseOutputTags: string[];

    constructor(
        private modelId: string = bedrockConfig.modelId,
        private region: string = bedrockConfig.region,
        private systemPrompt: string = bedrockConfig.systemPrompt
    ) {
        this.client = new BedrockRuntimeClient({ region: this.region });
        this.messages = [];
        this.responseOutputTags = [];
    }

    async invokeWithPrompt(prompt: string): Promise<string> {
        const content: ContentBlock[] = [{ text: prompt }];
        return this.invoke(content);
    }

    async invoke(content: ContentBlock[]): Promise<string> {
        this.messages.push({
            role: 'user',
            content
        });

        const response = await this.getConverseResponse();
        return this.handleResponse(response);
    }

    private async getConverseResponse(): Promise<any> {
        const tools = this.tools?.getTools().tools || [];
        // console.log('Tools:', JSON.stringify(tools, null, 2));

        const requestBody = {
            modelId: this.modelId,
            messages: this.messages,
            system: [{ text: this.systemPrompt }],
            toolConfig: tools.length > 0 ? {
                tools,
                toolChoice: { auto: {} }
            } : undefined,
            ...bedrockConfig.inferenceConfig,
            // anthropicVersion: bedrockConfig.anthropicVersion
        };
        // console.log('Request body:', JSON.stringify(requestBody, null, 2));

        const command = new ConverseCommand(requestBody);
        const response = await this.client.send(command);
        // console.log('Response:', JSON.stringify(response, null, 2));
        return response;
    }

    private async handleResponse(response: any): Promise<string> {
        // Add the response to the conversation history
        if (response.output?.message) {
            this.messages.push(response.output.message);
        }

        const stopReason = response.stopReason;

        if (stopReason === ConversationStopReason.END_TURN || stopReason === ConversationStopReason.STOP_SEQUENCE) {
            try {
                const message = response.output?.message;
                const content = message?.content || [];
                const text = content[0]?.text || '';

                if (this.responseOutputTags.length === 2) {
                    const pattern = new RegExp(`(?s).*${this.responseOutputTags[0]}(.*?)${this.responseOutputTags[1]}`);
                    const match = pattern.exec(text);
                    if (match) {
                        return match[1];
                    }
                }
                return text;
            } catch (error) {
                return '';
            }
        } else if (stopReason === ConversationStopReason.TOOL_USE) {
            try {
                const toolResults: ContentBlock[] = [];
                const toolUses = response.output?.message?.content?.filter(item => 'toolUse' in item) || [];

                for (const item of toolUses) {
                    const toolUse = (item as { toolUse: ToolUseBlock }).toolUse;
                    if (!toolUse) continue;

                    const toolResult = await this.tools?.executeToolAsync(toolUse);
                    if (toolResult) {
                        toolResults.push({ toolResult });
                    }
                }

                return this.invoke(toolResults);
            } catch (error) {
                throw new Error(`Failed to execute tool: ${error}`);
            }
        } else if (stopReason === ConversationStopReason.MAX_TOKENS) {
            return this.invokeWithPrompt('Please continue.');
        } else {
            throw new Error(`Unknown stop reason: ${stopReason}`);
        }
    }

    setTools(tools: ConversationToolConfig): void {
        this.tools = tools;
    }

    setResponseOutputTags(tags: string[]): void {
        this.responseOutputTags = tags;
    }

    clearMessages(): void {
        this.messages = [];
    }
} 