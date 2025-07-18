import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Agent } from './construct';
import { Agent as AgentType } from 'generative-ai-use-cases';
import { ProcessedStackInput } from './stack-input';
import { IVpc } from 'aws-cdk-lib/aws-ec2';

export interface AgentStackProps extends StackProps {
  readonly params: ProcessedStackInput;
  readonly vpc?: IVpc;
}

export class AgentStack extends Stack {
  public readonly agents: AgentType[];

  constructor(scope: Construct, id: string, props: AgentStackProps) {
    super(scope, id, props);

    const { searchAgentEnabled, searchApiKey, searchEngine } = props.params;

    const agent = new Agent(this, 'Agent', {
      searchAgentEnabled,
      searchApiKey,
      searchEngine,
      vpc: props.vpc,
    });

    this.agents = agent.agents;
  }
}
