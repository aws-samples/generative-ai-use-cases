import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { GenericAgentCore } from '../../lib/construct/generic-agent-core';

type Authorizer = {
  CustomJWTAuthorizer?: {
    DiscoveryUrl: string;
    AllowedClients?: string[];
  };
};

const runtimesOf = (props: {
  userPoolId?: string;
  userPoolClientId?: string;
}) => {
  const stack = new Stack(new App(), 'TestStack', {
    env: { account: '123456789012', region: 'ap-northeast-1' },
  });
  new GenericAgentCore(stack, 'AgentCore', {
    env: '',
    createGenericRuntime: true,
    ...props,
  });
  const found = Template.fromStack(stack).findResources(
    'AWS::BedrockAgentCore::Runtime'
  );
  return Object.values(found).map(
    (r) => r.Properties.AuthorizerConfiguration as Authorizer | undefined
  );
};

describe('AgentCore runtime authorizer', () => {
  // Without a pool the caller is whoever the payload says it is, which is
  // fine for a log line and not for deciding whose files to open.
  it('leaves the runtime on IAM when no pool is named', () => {
    for (const authorizer of runtimesOf({})) {
      expect(authorizer?.CustomJWTAuthorizer).toBeUndefined();
    }
  });

  it('leaves it on IAM when only half the pool is named', () => {
    expect(
      runtimesOf({ userPoolId: 'ap-northeast-1_abc' })[0]?.CustomJWTAuthorizer
    ).toBeUndefined();
    expect(
      runtimesOf({ userPoolClientId: 'client' })[0]?.CustomJWTAuthorizer
    ).toBeUndefined();
  });

  it('validates tokens against the pool when one is named', () => {
    const [authorizer] = runtimesOf({
      userPoolId: 'ap-northeast-1_abc',
      userPoolClientId: 'client123',
    });
    expect(authorizer?.CustomJWTAuthorizer?.DiscoveryUrl).toBe(
      'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_abc/.well-known/openid-configuration'
    );
    expect(authorizer?.CustomJWTAuthorizer?.AllowedClients).toEqual([
      'client123',
    ]);
  });

  // The discovery URL has to name the region the pool is in. The runtimes
  // may be deployed to another region than the pool (the model region).
  it('points at the region the pool is in, not the stack', () => {
    const stack = new Stack(new App(), 'TestStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });
    new GenericAgentCore(stack, 'AgentCore', {
      env: '',
      createGenericRuntime: true,
      userPoolId: 'ap-northeast-1_xyz',
      userPoolClientId: 'client',
    });
    const found = Template.fromStack(stack).findResources(
      'AWS::BedrockAgentCore::Runtime'
    );
    const authorizer = Object.values(found)[0].Properties
      .AuthorizerConfiguration as Authorizer;
    expect(authorizer.CustomJWTAuthorizer?.DiscoveryUrl).toContain(
      'cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xyz'
    );
  });
});
