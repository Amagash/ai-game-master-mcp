import { ConversationRole } from "@aws-sdk/client-bedrock-runtime";

export interface ContentBlock {
    text?: string;
    toolUse?: ToolUseBlock;
    toolResult?: ToolResultBlock;
}

export interface ToolUseBlock {
    toolUseId: string;
    name: string;
    input: any;
}

export interface ToolResultBlock {
    toolUseId: string;
    content: Array<{ text: string }>;
    status: 'success' | 'error';
}

export interface ConversationMessage {
    role: ConversationRole;
    content: ContentBlock[];
}

export interface ConversationToolSpec {
    toolSpec: {
        name: string;
        description: string;
        inputSchema: {
            json: {
                type: string;
                properties: Record<string, any>;
                required?: string[];
            };
        };
    };
}

export interface ConversationToolConfig {
    getTools(): { tools: ConversationToolSpec[] };
    executeToolAsync(payload: ToolUseBlock): Promise<ToolResultBlock>;
}

export interface ConversationResponse {
    output?: {
        message: ConversationMessage;
    };
    stopReason: 'end_turn' | 'stop_sequence' | 'tool_use' | 'max_tokens';
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    metrics?: {
        latencyMs: number;
    };
}

export enum ConversationStopReason {
    END_TURN = 'end_turn',
    STOP_SEQUENCE = 'stop_sequence',
    TOOL_USE = 'tool_use',
    MAX_TOKENS = 'max_tokens'
} 