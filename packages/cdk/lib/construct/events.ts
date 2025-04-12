import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';

export interface EventsProps {
  userPool: cognito.UserPool;
}

export class Events extends Construct {
  constructor(scope: Construct, id: string, props: EventsProps) {
    super(scope, id);

    const eventApi = new appsync.EventApi(this, 'EventApi', {
      apiName: 'GenUEvents', // TODO: add stg
      authorizationConfig: {
        authProviders: [{
          authorizationType: appsync.AppSyncAuthorizationType.IAM,
        },{
          authorizationType: appsync.AppSyncAuthorizationType.USER_POOL,
          cognitoConfig: {
            userPool: props.userPool,
          },
        }],
        connectionAuthModeTypes: [appsync.AppSyncAuthorizationType.IAM, appsync.AppSyncAuthorizationType.USER_POOL],
        defaultPublishAuthModeTypes: [appsync.AppSyncAuthorizationType.IAM, appsync.AppSyncAuthorizationType.USER_POOL],
        defaultSubscribeAuthModeTypes: [appsync.AppSyncAuthorizationType.IAM, appsync.AppSyncAuthorizationType.USER_POOL],
      },
    });

    // TODO: avoid hardcoded namespace
    const namespace = new appsync.ChannelNamespace(this, 'ChannelName', {
      api: eventApi,
      channelNamespaceName: 'default',
    });

    const lambda = new NodejsFunction(this, 'NovaSonic', {
      runtime: Runtime.NODEJS_LATEST,
      entry: './lambda/nova-sonic-lambda.ts',
      timeout: Duration.minutes(15),
      environment: {
        EVENT_API_ENDPOINT: `https://${eventApi.httpDns}`,
      },
      bundling: {
        nodeModules: ['@aws-sdk/client-bedrock-runtime'],
      },
    });

    eventApi.grantConnect(lambda);
    namespace.grantPublishAndSubscribe(lambda);

    lambda.role?.addToPrincipalPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      resources: ['*'],
      actions: ['bedrock:*'],
    }));
  }
}
