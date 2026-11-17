import { Construct } from 'constructs';
import { Stack } from 'aws-cdk-lib';
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { CfnGateway, CfnGatewayTarget } from 'aws-cdk-lib/aws-bedrockagentcore';

// The gateway is created in the same Region as the other AgentCore resources
// (agentCoreRegion). Note that the Web Search Tool connector is only available
// in a subset of Regions.
// See https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-target-connector-web-search-tool.html
//
// The connector version is not pinned because AWS::BedrockAgentCore::GatewayTarget
// ConnectorSource only accepts ConnectorId, so the connector default version is
// used. Target level domainFilter.exclude works with the default version, while
// request level filters require version 1.2.0 or later.

export interface WebSearchGatewayProps {
  env: string;
  // Domains excluded from all searches through this gateway.
  // Enforced server side and hidden from the calling agent.
  excludeDomains?: string[];
}

/**
 * Provisions an AgentCore Gateway with the built-in Web Search connector.
 *
 * The gateway uses AWS_IAM inbound authorization so that the AgentCore Runtime
 * can call it with SigV4 using its execution role. No API key or OAuth client
 * is required.
 */
export class WebSearchGateway extends Construct {
  public readonly gatewayUrl: string;
  public readonly gatewayArn: string;

  constructor(scope: Construct, id: string, props: WebSearchGatewayProps) {
    super(scope, id);

    const region = Stack.of(this).region;
    const accountId = Stack.of(this).account;

    // Service role assumed by the gateway
    const role = new Role(this, 'WebSearchGatewayRole', {
      assumedBy: new ServicePrincipal('bedrock-agentcore.amazonaws.com', {
        conditions: {
          StringEquals: { 'aws:SourceAccount': accountId },
        },
      }),
    });

    role.addToPolicy(
      new PolicyStatement({
        sid: 'InvokeGateway',
        effect: Effect.ALLOW,
        actions: ['bedrock-agentcore:InvokeGateway'],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:${accountId}:gateway/*`,
        ],
      })
    );

    // Checked per request against the service owned tool ARN
    role.addToPolicy(
      new PolicyStatement({
        sid: 'InvokeWebSearch',
        effect: Effect.ALLOW,
        actions: ['bedrock-agentcore:InvokeWebSearch'],
        resources: [
          `arn:aws:bedrock-agentcore:${region}:aws:tool/web-search.v1`,
        ],
      })
    );

    const gateway = new CfnGateway(this, 'WebSearchGateway', {
      name: `GenUWebSearchGateway${props.env}`,
      roleArn: role.roleArn,
      protocolType: 'MCP',
      authorizerType: 'AWS_IAM',
      description: 'AgentCore Web Search gateway for GenU agent builder',
    });

    const parameterValues: Record<string, unknown> = {};
    if (props.excludeDomains && props.excludeDomains.length > 0) {
      parameterValues.domainFilter = { exclude: props.excludeDomains };
    }

    const target = new CfnGatewayTarget(this, 'WebSearchTarget', {
      gatewayIdentifier: gateway.attrGatewayIdentifier,
      name: 'web-search',
      targetConfiguration: {
        mcp: {
          connector: {
            source: {
              connectorId: 'web-search',
            },
            configurations: [{ name: 'WebSearch', parameterValues }],
          },
        },
      },
      credentialProviderConfigurations: [
        { credentialProviderType: 'GATEWAY_IAM_ROLE' },
      ],
    });
    target.node.addDependency(gateway);

    this.gatewayUrl = gateway.attrGatewayUrl;
    this.gatewayArn = gateway.attrGatewayArn;
  }
}
