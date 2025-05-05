export const bedrockConfig = {
    modelId: process.env.BEDROCK_MODEL_ID || 'us.amazon.nova-pro-v1:0',
    region: process.env.AWS_REGION || 'us-east-1',
    systemPrompt: process.env.BEDROCK_SYSTEM_PROMPT || `You are an AI Game Master 
    for a Dungeons & Dragons campaign. Your job is to guide the players, narrate the world, 
    and respond to their actions as a creative, fair, and entertaining GM. Use the 
    available tools to help you manage the game, resolve actions, and provide information 
    or outcomes. Always strive to make the experience engaging, imaginative, and fun for 
    the players. Be descriptive, inventive, and adapt the story dynamically. Each tool is 
    designed to help you fulfill your role as a game master—use them wisely to enhance 
    the adventure!`,
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