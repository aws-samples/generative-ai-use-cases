import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Agent } from './construct';
import { Agent as AgentType } from 'generative-ai-use-cases';
import { ProcessedStackInput } from './stack-input';

export interface AgentStackProps extends StackProps {
  readonly params: ProcessedStackInput;
}

export class AgentStack extends Stack {
  public readonly agents: AgentType[];

  constructor(scope: Construct, id: string, props: AgentStackProps) {
    super(scope, id, props);

    const { searchAgentEnabled, searchApiKey } = props.params;

    const agent = new Agent(this, 'Agent', {
      searchAgentEnabled,
      searchApiKey,
    });

    this.agents = agent.agents;
  }
}
