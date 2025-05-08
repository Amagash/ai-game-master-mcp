import { MCPConverseClient } from './MCPConverseClient.js';
import * as readline from 'readline';
import chalk from 'chalk';
import { serverConfig } from './config/bedrock.js';
import awsClientManager from './config/aws-client.js';

// --- Express API for Streamlit UI ---
import express from 'express';
import bodyParser from 'body-parser';

const app = express();
app.use(bodyParser.json());

const serverUrl = serverConfig.url;
const apiToken = serverConfig.apiToken;

// Create a shared client instance
let sharedClient: MCPConverseClient | null = null;

// Initialize the shared client
async function initializeSharedClient() {
    if (!sharedClient) {
        console.log(chalk.cyan('Initializing shared MCP client...'));
        sharedClient = new MCPConverseClient(serverUrl, apiToken);
        
        try {
            await sharedClient.connect();
            console.log(chalk.green('Shared MCP client initialized successfully'));
        } catch (error) {
            console.error(chalk.red('Failed to initialize shared MCP client:'), error);
            console.log(chalk.yellow('Creating a new client with limited functionality'));
            
            // Create a new client even if initialization failed
            sharedClient = new MCPConverseClient(serverUrl, apiToken);
        }
    }
    return sharedClient;
}

// Add a health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok',
        aws: awsClientManager.getBedrockClient() ? 'connected' : 'disconnected'
    });
});

// Add API endpoint for conversation
app.post('/converse', async (req, res) => {
    try {
        const userInput = req.body.input;
        if (!userInput) {
            return res.status(400).json({ error: 'Missing input' });
        }
        
        console.log(chalk.blue(`[API] Received request: ${userInput}`));
        
        // Special case for ping
        if (userInput === 'ping') {
            return res.json({ reply: 'pong' });
        }
        
        // Get the shared client
        const client = await initializeSharedClient();
        
        // Use the shared client to invoke the model
        const response = await client.invokeWithPrompt(userInput);
        console.log(chalk.green(`[API] Sending response for: ${userInput}`));
        
        res.json({ reply: response });
    } catch (error) {
        console.error(chalk.red(`[API] Error: ${error}`));
        res.status(500).json({ error: error?.toString() || 'Unknown error' });
    }
});

// Start the Express server and bind to all interfaces
const server = app.listen(8080, '0.0.0.0', () => {
    console.log(chalk.green('Express API listening on port 8080 (0.0.0.0)'));
});

// Prevent the Node.js process from exiting when the CLI part exits
process.on('SIGINT', () => {
    console.log(chalk.yellow('Received SIGINT. Closing server...'));
    server.close(() => {
        console.log(chalk.yellow('Server closed. Exiting...'));
        process.exit(0);
    });
});

// --- End Express API ---

// Initialize AWS client manager at startup
awsClientManager.initialize().then(success => {
    if (success) {
        console.log(chalk.green('AWS client manager initialized successfully'));
    } else {
        console.log(chalk.yellow('AWS client manager initialization failed, continuing with mock responses'));
    }
}).catch(error => {
    console.error(chalk.red('Failed to initialize AWS client manager:'), error);
    console.log(chalk.yellow('Continuing with mock responses...'));
});

// Initialize the shared client at startup
initializeSharedClient().catch(error => {
    console.error(chalk.red('Failed to initialize shared client:'), error);
    console.log(chalk.yellow('Continuing with mock responses...'));
});

async function main() {
    try {
        // Create a client for CLI use
        const cliClient = new MCPConverseClient(serverUrl, apiToken);
        await cliClient.connect();
        
        console.log(chalk.cyan('Connected to MCP server'));
        console.log(chalk.cyan('Type "quit" or "exit" to end the session\n'));

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.setPrompt(chalk.blue('> '));
        rl.prompt();

        rl.on('line', async (line) => {
            const input = line.trim();
            
            if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
                await cliClient.close();
                rl.close();
                return;
            }

            if (!input) {
                rl.prompt();
                return;
            }

            await cliClient.processUserInput(input);
            rl.prompt();
        });

        rl.on('close', () => {
            console.log(chalk.cyan('\nGoodbye!'));
            // Don't exit the process here to keep the Express server running
            // process.exit(0);
        });
    } catch (error) {
        console.error(chalk.red('Error:'), error);
        // Don't exit the process on error
        // process.exit(1);
    }
}

main();
