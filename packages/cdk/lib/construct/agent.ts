import { Duration, Lazy, Names, RemovalPolicy } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
} from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { CfnAgent, CfnAgentAlias } from 'aws-cdk-lib/aws-bedrock';
import { Agent as AgentType } from 'generative-ai-use-cases';

interface AgentProps {
  // Context Params
  readonly searchAgentEnabled: boolean;
  readonly searchApiKey?: string | null;
}

export class Agent extends Construct {
  public readonly agents: AgentType[] = [];

  constructor(scope: Construct, id: string, props: AgentProps) {
    super(scope, id);

    const suffix = Lazy.string({ produce: () => Names.uniqueId(this) });

    const { searchAgentEnabled, searchApiKey } = props;

    // Bucket to store schema and data for agents for bedrock
    const s3Bucket = new Bucket(this, 'Bucket', {
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    // Deploy schema to s3
    const schema = new BucketDeployment(this, 'ApiSchemaBucket', {
      sources: [Source.asset('assets/api-schema')],
      destinationBucket: s3Bucket,
      destinationKeyPrefix: 'api-schema',
    });

    // Agent
    const bedrockAgentRole = new Role(this, 'BedrockAgentRole', {
      assumedBy: new ServicePrincipal('bedrock.amazonaws.com'),
      inlinePolicies: {
        BedrockAgentS3BucketPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              resources: [s3Bucket.bucketArn, `${s3Bucket.bucketArn}/*`],
              actions: ['*'],
            }),
          ],
        }),
        BedrockAgentBedrockModelPolicy: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              resources: ['*'],
              actions: ['bedrock:*'],
            }),
          ],
        }),
      },
    });

    // Search Agent
    if (searchAgentEnabled && searchApiKey) {
      const bedrockAgentLambda = new NodejsFunction(
        this,
        'BedrockAgentLambda',
        {
          runtime: Runtime.NODEJS_LATEST,
          entry: './lambda/agent.ts',
          timeout: Duration.seconds(300),
          environment: {
            SEARCH_API_KEY: searchApiKey ?? '',
          },
        }
      );
      bedrockAgentLambda.grantInvoke(
        new ServicePrincipal('bedrock.amazonaws.com')
      );

      const searchAgent = new CfnAgent(this, 'SearchAgent', {
        agentName: `SearchEngineAgent-${suffix}`,
        actionGroups: [
          {
            actionGroupName: 'Search',
            actionGroupExecutor: {
              lambda: bedrockAgentLambda.functionArn,
            },
            apiSchema: {
              s3: {
                s3BucketName: schema.deployedBucket.bucketName,
                s3ObjectKey: 'api-schema/api-schema.json',
              },
            },
            description: 'Search',
          },
          {
            actionGroupName: 'UserInputAction',
            parentActionGroupSignature: 'AMAZON.UserInput',
          },
        ],
        agentResourceRoleArn: bedrockAgentRole.roleArn,
        idleSessionTtlInSeconds: 3600,
        autoPrepare: true,
        description: 'Search Agent',
        foundationModel: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
        instruction: `You are an advanced assistant with the ability to search and retrieve information from the web to perform complex research tasks.
Your main function is to solve problems and meet user requests by utilizing these capabilities.
Your main characteristics and instructions are as follows.

- Understand the user's request and construct hypothesis on research strategy. If the user's request is not clear, ask the user for more information.
- Think right search keywords to retrieve information relevant to the user's request.
- Search the web for information relevant to the user's request.
- Retrieve information from the web to answer the user's request.
- If the information needed to respond to the instruction is sufficient, answer immediately.
- If the information is insufficient, revise research strategy and collect more information.
- Multiple searches are possible. You can search up to 5 times.

Automatically detect the language of the user's request and think and answer in the same language.`,
      });

      const searchAgentAlias = new CfnAgentAlias(this, 'SearchAgentAlias', {
        agentId: searchAgent.attrAgentId,
        agentAliasName: 'v1',
      });

      this.agents.push({
        displayName: 'SearchEngine',
        agentId: searchAgent.attrAgentId,
        aliasId: searchAgentAlias.attrAgentAliasId,
      });
    }

    // Code Interpreter Agent
    const codeInterpreterAgent = new CfnAgent(this, 'CodeInterpreterAgent', {
      agentName: `CodeInterpreterAgent-${suffix}`,
      actionGroups: [
        {
          actionGroupName: 'CodeInterpreter',
          parentActionGroupSignature: 'AMAZON.CodeInterpreter',
        },
      ],
      agentResourceRoleArn: bedrockAgentRole.roleArn,
      idleSessionTtlInSeconds: 3600,
      autoPrepare: true,
      description: 'Code Interpreter',
      foundationModel: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
      instruction: `You are an advanced AI agent with the ability to execute code, generate charts, and perform complex data analysis. 
Your main function is to solve problems and meet user requests by utilizing these capabilities.
Your main characteristics and instructions are as follows.

Code Execution:
- Access the Python environment in real time to write and run code.
- When asked to perform calculations or data operations, always use this code execution feature to ensure accuracy.
- After running the code, report the exact output and explain the results.

Data Analysis:
- You are excellent at statistical analysis, data visualization, machine learning applications, and other complex data analysis tasks.
- Understand the problem, prepare the data, perform the analysis, and interpret the results systematically.

Problem Solving Approach:
- When a problem or request is presented, break it down into steps.
- Clearly communicate the process and steps taken.
- If a task requires multiple steps or tools, outline the approach before starting.

Transparency and Accuracy:
- Always clarify what you are doing. If you are executing code, inform the user. If you are generating an image, explain that.
- If you are unsure about something or the task exceeds your capabilities, clearly communicate that.
- Do not present hypothetical results as actual results. Only report actual results from code execution or image generation.

Dialog Style:
- Provide a concise answer to simple questions and a detailed explanation for complex tasks.
- Use appropriate technical terms, but be prepared to explain in simple terms if requested.
- Actively propose useful related information or alternative approaches.

Continuous Improvement:
- After completing a task, ask the user if they need an explanation.
- Listen to feedback and adjust the approach accordingly.

Your goal is to provide support that is accurate and useful by utilizing the unique features of code execution, image generation, and data analysis.
Always strive to provide the most practical and effective solutions to user requests.

Automatically detect the language of the user's request and think and answer in the same language.`,
    });

    const codeInterpreterAgentAlias = new CfnAgentAlias(
      this,
      'CodeInterpreterAgentAlias',
      {
        agentId: codeInterpreterAgent.attrAgentId,
        agentAliasName: 'v1',
      }
    );

    this.agents.push({
      displayName: 'CodeInterpreter',
      agentId: codeInterpreterAgent.attrAgentId,
      aliasId: codeInterpreterAgentAlias.attrAgentAliasId,
    });
  }
}
