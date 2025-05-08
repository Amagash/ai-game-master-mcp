import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { fromEnv, fromIni, fromProcess } from '@aws-sdk/credential-providers';
import chalk from 'chalk';

/**
 * Singleton class for managing AWS Bedrock client instances
 */
export class AWSClientManager {
  private static instance: AWSClientManager;
  private bedrockClients: Map<string, BedrockRuntimeClient> = new Map();
  private isInitialized = false;

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Get the singleton instance of AWSClientManager
   */
  public static getInstance(): AWSClientManager {
    if (!AWSClientManager.instance) {
      AWSClientManager.instance = new AWSClientManager();
    }
    return AWSClientManager.instance;
  }

  /**
   * Create a credential provider chain that tries multiple sources
   */
  private createCredentialProviderChain() {
    return async () => {
      // Try different credential sources in order
      const providers = [
        // 1. Try environment variables first
        async () => {
          try {
            console.log(chalk.blue('Trying environment variables for credentials...'));
            return await fromEnv()();
          } catch (e) {
            console.log(chalk.yellow('No environment credentials found.'));
            throw e;
          }
        },
        
        // 2. Try shared credentials file
        async () => {
          try {
            console.log(chalk.blue('Trying shared credentials file...'));
            return await fromIni()();
          } catch (e) {
            console.log(chalk.yellow('No shared credentials found.'));
            throw e;
          }
        },
        
        // 3. Try process credentials (ECS, EC2 role, etc.)
        async () => {
          try {
            console.log(chalk.blue('Trying process credentials...'));
            return await fromProcess()();
          } catch (e) {
            console.log(chalk.yellow('No process credentials found.'));
            throw e;
          }
        }
      ];
      
      // Try each provider in sequence
      for (const provider of providers) {
        try {
          return await provider();
        } catch (e) {
          // Continue to next provider
        }
      }
      
      // If all providers fail, throw an error
      throw new Error('No credentials available from any source');
    };
  }

  /**
   * Initialize the AWS client manager
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      console.log(chalk.yellow('AWS Client Manager already initialized'));
      return true;
    }

    try {
      // Create credential provider chain
      const credentialProvider = this.createCredentialProviderChain();
      
      // Test credentials by trying to load them
      try {
        const credentials = await credentialProvider();
        console.log(chalk.green('AWS credentials loaded successfully'));
        console.log(chalk.green(`Access Key ID: ${credentials.accessKeyId.substring(0, 5)}...`));
        
        this.isInitialized = true;
        return true;
      } catch (error) {
        console.error(chalk.red('Failed to load AWS credentials:'), error);
        console.log(chalk.yellow('Will continue with mock functionality'));
        return false;
      }
    } catch (error) {
      console.error(chalk.red('Failed to initialize AWS credentials:'), error);
      return false;
    }
  }

  /**
   * Get a Bedrock client for a specific region
   * @param region AWS region
   * @returns BedrockRuntimeClient or null if credentials aren't available
   */
  public getBedrockClient(region: string = 'us-east-1'): BedrockRuntimeClient | null {
    if (!this.isInitialized) {
      console.log(chalk.yellow('AWS Client Manager not initialized. Returning null client.'));
      return null;
    }

    // Return existing client if we have one for this region
    if (this.bedrockClients.has(region)) {
      return this.bedrockClients.get(region);
    }

    // Create a new client for this region
    try {
      const client = new BedrockRuntimeClient({
        region,
        credentials: this.createCredentialProviderChain(),
        maxAttempts: 3
      });
      
      this.bedrockClients.set(region, client);
      console.log(chalk.green(`Created Bedrock client for region: ${region}`));
      
      return client;
    } catch (error) {
      console.error(chalk.red(`Failed to create Bedrock client for region ${region}:`), error);
      return null;
    }
  }

  /**
   * Reset all clients (useful for testing or credential refresh)
   */
  public reset(): void {
    this.bedrockClients.clear();
    this.isInitialized = false;
    console.log(chalk.yellow('AWS Client Manager reset'));
  }
}

export default AWSClientManager.getInstance();
