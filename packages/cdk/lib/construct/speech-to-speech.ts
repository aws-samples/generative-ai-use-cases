import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as agw from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { ModelConfiguration } from 'generative-ai-use-cases';
import { BEDROCK_SPEECH_TO_SPEECH_MODELS } from '@generative-ai-use-cases/common';

export interface SpeechToSpeechProps {
  readonly envSuffix: string;
  readonly userPool: cognito.UserPool;
  readonly api: agw.RestApi;
  readonly speechToSpeechModelIds: ModelConfiguration[];
  readonly crossAccountBedrockRoleArn?: string | null;
}

export class SpeechToSpeech extends Construct {
  public readonly namespace: string;
  public readonly eventApiEndpoint: string;

  constructor(scope: Construct, id: string, props: SpeechToSpeechProps) {
    super(scope, id);

    const speechToSpeechModelIds = props.speechToSpeechModelIds;

    for (const model of speechToSpeechModelIds) {
      if (!BEDROCK_SPEECH_TO_SPEECH_MODELS.includes(model.modelId)) {
        throw new Error(`Unsupported Model Name: ${model.modelId}`);
      }
    }

    const channelNamespaceName = 'speech-to-speech';
    const eventApi = new appsync.EventApi(this, 'EventApi', {
      apiName: `SpeechToSpeech${props.envSuffix}`,
      authorizationConfig: {
        authProviders: [
          {
            authorizationType: appsync.AppSyncAuthorizationType.IAM,
          },
          {
            authorizationType: appsync.AppSyncAuthorizationType.USER_POOL,
            cognitoConfig: {
              userPool: props.userPool,
            },
          },
        ],
        connectionAuthModeTypes: [
          appsync.AppSyncAuthorizationType.IAM,
          appsync.AppSyncAuthorizationType.USER_POOL,
        ],
        defaultPublishAuthModeTypes: [
          appsync.AppSyncAuthorizationType.IAM,
          appsync.AppSyncAuthorizationType.USER_POOL,
        ],
        defaultSubscribeAuthModeTypes: [
          appsync.AppSyncAuthorizationType.IAM,
          appsync.AppSyncAuthorizationType.USER_POOL,
        ],
      },
    });

    const namespace = new appsync.ChannelNamespace(this, 'ChannelName', {
      api: eventApi,
      channelNamespaceName,
    });

    const eventApiEndpoint = `https://${eventApi.httpDns}/event`;

    const speechToSpeechTask = new NodejsFunction(this, 'Task', {
      runtime: Runtime.NODEJS_LATEST,
      entry: './lambda/speechToSpeechTask.ts',
      timeout: Duration.minutes(15),
      environment: {
        EVENT_API_ENDPOINT: eventApiEndpoint,
        NAMESPACE: channelNamespaceName,
        CROSS_ACCOUNT_BEDROCK_ROLE_ARN: props.crossAccountBedrockRoleArn ?? '',
      },
      bundling: {
        nodeModules: ['@aws-sdk/client-bedrock-runtime'],
      },
      memorySize: 512,
    });

    eventApi.grantConnect(speechToSpeechTask);
    namespace.grantPublishAndSubscribe(speechToSpeechTask);

    if (!props.crossAccountBedrockRoleArn) {
      speechToSpeechTask.role?.addToPrincipalPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: ['*'],
          actions: ['bedrock:*'],
        })
      );
    } else {
      const logsPolicy = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['logs:*'],
        resources: ['*'],
      });
      const assumeRolePolicy = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [props.crossAccountBedrockRoleArn],
      });
      speechToSpeechTask.role?.addToPrincipalPolicy(logsPolicy);
      speechToSpeechTask.role?.addToPrincipalPolicy(assumeRolePolicy);
    }

    const startSpeechToSpeechSession = new NodejsFunction(
      this,
      'StartSession',
      {
        runtime: Runtime.NODEJS_LATEST,
        entry: './lambda/startSpeechToSpeechSession.ts',
        timeout: Duration.minutes(15),
        environment: {
          SPEECH_TO_SPEECH_TASK_FUNCTION_ARN: speechToSpeechTask.functionArn,
        },
        bundling: {
          nodeModules: ['@aws-sdk/client-bedrock-runtime'],
        },
      }
    );

    speechToSpeechTask.grantInvoke(startSpeechToSpeechSession);

    const authorizer = new agw.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [props.userPool],
    });

    const commonAuthorizerProps = {
      authorizationType: agw.AuthorizationType.COGNITO,
      authorizer,
    };

    const speechToSpeechResource =
      props.api.root.addResource('speech-to-speech');

    speechToSpeechResource.addMethod(
      'POST',
      new agw.LambdaIntegration(startSpeechToSpeechSession),
      commonAuthorizerProps
    );

    this.namespace = channelNamespaceName;
    this.eventApiEndpoint = eventApiEndpoint;
  }
}
