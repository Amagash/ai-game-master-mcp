export const bedrockConfig = {
    modelId: process.env.BEDROCK_MODEL_ID || 'us.amazon.nova-pro-v1:0',
    region: process.env.AWS_REGION || 'us-west-2',
    systemPrompt: process.env.BEDROCK_SYSTEM_PROMPT || `You are a helpful assistant that can use tools to help you answer questions and perform tasks.

When using tools, follow these guidelines to be efficient:
1. Plan your tool usage before making calls - determine exactly what information you need
2. Make each tool call count - don't repeat the same call with the same parameters
3. Only make additional tool calls if the information you have is insufficient
4. Trust the results you get - don't make verification calls unless explicitly asked
5. When getting location-based information (weather, time, etc.), get the location info once and reuse it

Remember: Each tool call is expensive, so use them judiciously while still providing accurate and helpful responses.`,
    inferenceConfig: {
        maxTokens: 8192,
        temperature: 0.7,
        topP: 0.999,
        stopSequences: []
    }
};

export const serverConfig = {
    url: process.env.MCP_URL || 'http://localhost:3000',
    apiToken: process.env.MCP_TOKEN || '123123'
}; 