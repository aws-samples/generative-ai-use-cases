import { Stack, Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  Cors,
  Deployment,
  LambdaIntegration,
  RestApi,
  ResponseType,
  EndpointType,
  MethodOptions,
} from 'aws-cdk-lib/aws-apigateway';
import { UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import { LayerVersion, ILayerVersion } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { IdentityPool } from 'aws-cdk-lib/aws-cognito-identitypool';
import {
  AnyPrincipal,
  Effect,
  PolicyDocument,
  PolicyStatement,
} from 'aws-cdk-lib/aws-iam';
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
} from 'aws-cdk-lib/aws-s3';
import { Agent, AgentInfo, ModelConfiguration } from 'generative-ai-use-cases';
import {
  BEDROCK_IMAGE_GEN_MODELS,
  BEDROCK_VIDEO_GEN_MODELS,
  BEDROCK_RERANKING_MODELS,
  BEDROCK_TEXT_MODELS,
} from '@generative-ai-use-cases/common';
import { allowS3AccessWithSourceIpCondition } from '../utils/s3-access-policy';
import { LAMBDA_RUNTIME_NODEJS } from '../../consts';
import {
  InterfaceVpcEndpoint,
  IVpc,
  ISecurityGroup,
} from 'aws-cdk-lib/aws-ec2';

export interface BackendApiProps {
  readonly modelRegion: string;
  readonly modelIds: ModelConfiguration[];
  readonly imageGenerationModelIds: ModelConfiguration[];
  readonly videoGenerationModelIds: ModelConfiguration[];
  readonly videoBucketRegionMap: Record<string, string>;
  readonly endpointNames: ModelConfiguration[];
  readonly queryDecompositionEnabled: boolean;
  readonly rerankingModelId?: string | null;
  readonly customAgents: Agent[];
  readonly crossAccountBedrockRoleArn?: string | null;
  readonly userPool: UserPool;
  readonly idPool: IdentityPool;
  readonly userPoolClient: UserPoolClient;
  readonly table: Table;
  readonly statsTable: Table;
  readonly knowledgeBaseId?: string;
  readonly agents?: string;
  readonly guardrailIdentify?: string;
  readonly guardrailVersion?: string;
  readonly vpc?: IVpc;
  readonly securityGroups?: ISecurityGroup[];
  readonly apiGatewayVpcEndpoint?: InterfaceVpcEndpoint;
  // RAG
  readonly kendraIndexId?: string;
  readonly kendraIndexLanguage?: string;
  readonly knowledgeBaseDataSourceBucketName?: string;
  readonly dataSourceBucketName?: string;
  // Use Case Builder / Agent Builder
  readonly useCaseBuilderTable?: Table;
  readonly useCaseIdIndexName?: string;
  readonly agentBuilderRuntimeArn?: string;
  // Transcribe
  readonly audioBucket?: Bucket;
  readonly transcriptBucket?: Bucket;
  // Speech to Speech
  readonly speechToSpeechTaskFunctionArn?: string;
  readonly speechToSpeechModelIds?: ModelConfiguration[];
  // IP restrictions
  readonly allowedIpV4AddressRanges?: string[];
  readonly allowedIpV6AddressRanges?: string[];
  readonly additionalS3Buckets?: Bucket[];
  // CORS
  readonly webUrl?: string;
}

export class Api extends Construct {
  readonly api: RestApi;
  readonly predictStreamFunction: NodejsFunction;
  readonly invokeFlowFunction: NodejsFunction;
  readonly optimizePromptFunction: NodejsFunction;
  readonly apiHandler: NodejsFunction;
  readonly modelRegion: string;
  readonly modelIds: ModelConfiguration[];
  readonly imageGenerationModelIds: ModelConfiguration[];
  readonly videoGenerationModelIds: ModelConfiguration[];
  readonly endpointNames: ModelConfiguration[];
  readonly agents: AgentInfo[];
  readonly fileBucket: Bucket;

  constructor(scope: Construct, id: string, props: BackendApiProps) {
    super(scope, id);

    const {
      modelRegion,
      modelIds,
      imageGenerationModelIds,
      videoGenerationModelIds,
      endpointNames,
      crossAccountBedrockRoleArn,
      userPool,
      userPoolClient,
      table,
      idPool,
      knowledgeBaseId,
      queryDecompositionEnabled,
      rerankingModelId,
      vpc,
      securityGroups,
      apiGatewayVpcEndpoint,
    } = props;

    const builtinAgentsJson = props.agents || '[]';
    const customAgentsJson = JSON.stringify(props.customAgents);

    // Validate Model Names
    for (const model of modelIds) {
      if (!BEDROCK_TEXT_MODELS.includes(model.modelId)) {
        throw new Error(`Unsupported Model Name: ${model.modelId}`);
      }
    }
    for (const model of imageGenerationModelIds) {
      if (!BEDROCK_IMAGE_GEN_MODELS.includes(model.modelId)) {
        throw new Error(`Unsupported Model Name: ${model.modelId}`);
      }
    }
    for (const model of videoGenerationModelIds) {
      if (!BEDROCK_VIDEO_GEN_MODELS.includes(model.modelId)) {
        throw new Error(`Unsupported Model Name: ${model.modelId}`);
      }
    }
    if (
      rerankingModelId &&
      !BEDROCK_RERANKING_MODELS.includes(rerankingModelId)
    ) {
      throw new Error(`Unsupported Model Name: ${rerankingModelId}`);
    }

    const duplicateModelIds = new Set(
      [...modelIds, ...imageGenerationModelIds, ...videoGenerationModelIds]
        .map((m) => m.modelId)
        .filter((item, index, arr) => arr.indexOf(item) !== index)
    );
    if (duplicateModelIds.size > 0) {
      throw new Error(
        'Duplicate model IDs detected. Using the same model ID multiple times is not supported:\n' +
          [...duplicateModelIds].map((s) => `- ${s}\n`).join('\n')
      );
    }

    // S3 File Bucket
    const fileBucket = new Bucket(this, 'FileBucket', {
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      enforceSSL: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });
    fileBucket.addCorsRule({
      allowedOrigins: ['*'],
      allowedMethods: [HttpMethods.GET, HttpMethods.POST, HttpMethods.PUT],
      allowedHeaders: ['*'],
      exposedHeaders: [],
      maxAge: 3000,
    });

    // Bedrock SDK modules to bundle into Lambda functions
    // These are newer than the Lambda runtime's built-in SDK
    const bedrockSdkModules = [
      '@aws-sdk/client-bedrock-runtime',
      '@aws-sdk/client-bedrock-agent-runtime',
      '@aws-sdk/client-sagemaker-runtime',
    ];
    const bedrockSdkBundling = {
      nodeModules: bedrockSdkModules,
    };

    // Lambda Web Adapter Layer
    const lwaLayer: ILayerVersion = LayerVersion.fromLayerVersionArn(
      this,
      'LwaLayer',
      `arn:aws:lambda:${Stack.of(this).region}:753240598075:layer:LambdaAdapterLayerX86:27`
    );

    // API Handler (Express Monolith)
    const apiHandler = new NodejsFunction(this, 'ApiHandler', {
      runtime: LAMBDA_RUNTIME_NODEJS,
      layers: [lwaLayer],
      entry: './lambda/api/index.ts',
      handler: 'run.sh',
      timeout: Duration.minutes(15),
      memorySize: 1024,
      bundling: {
        ...bedrockSdkBundling,
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (inputDir: string, outputDir: string) => [
            `cp ${inputDir}/packages/cdk/lambda/api/run.sh ${outputDir}/run.sh && chmod +x ${outputDir}/run.sh`,
          ],
        },
      },
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/bootstrap',
        PORT: '8080',
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        MODEL_REGION: modelRegion,
        MODEL_IDS: JSON.stringify(modelIds),
        IMAGE_GENERATION_MODEL_IDS: JSON.stringify(imageGenerationModelIds),
        VIDEO_GENERATION_MODEL_IDS: JSON.stringify(videoGenerationModelIds),
        BUILTIN_AGENTS_JSON: builtinAgentsJson,
        CUSTOM_AGENTS_JSON: customAgentsJson,
        CROSS_ACCOUNT_BEDROCK_ROLE_ARN: crossAccountBedrockRoleArn ?? '',
        BUCKET_NAME: fileBucket.bucketName,
        TABLE_NAME: table.tableName,
        STATS_TABLE_NAME: props.statsTable.tableName,
        KNOWLEDGE_BASE_ID: knowledgeBaseId ?? '',
        VIDEO_BUCKET_REGION_MAP: JSON.stringify(props.videoBucketRegionMap),
        QUERY_DECOMPOSITION_ENABLED: JSON.stringify(queryDecompositionEnabled),
        RERANKING_MODEL_ID: rerankingModelId ?? '',
        // RAG Kendra
        INDEX_ID: props.kendraIndexId ?? '',
        LANGUAGE: props.kendraIndexLanguage ?? 'ja',
        // Use Case Builder / Agent Builder
        USECASE_TABLE_NAME: props.useCaseBuilderTable?.tableName ?? '',
        USECASE_ID_INDEX_NAME: props.useCaseIdIndexName ?? '',
        // Transcribe
        AUDIO_BUCKET_NAME: props.audioBucket?.bucketName ?? '',
        TRANSCRIPT_BUCKET_NAME: props.transcriptBucket?.bucketName ?? '',
        // Speech to Speech
        SPEECH_TO_SPEECH_TASK_FUNCTION_ARN:
          props.speechToSpeechTaskFunctionArn ?? '',
        SPEECH_TO_SPEECH_MODEL_IDS: JSON.stringify(
          props.speechToSpeechModelIds ?? []
        ),
        ...(props.guardrailIdentify
          ? { GUARDRAIL_IDENTIFIER: props.guardrailIdentify }
          : {}),
        ...(props.guardrailVersion
          ? { GUARDRAIL_VERSION: props.guardrailVersion }
          : {}),
        // CORS allowed origins
        ALLOWED_ORIGINS: props.webUrl || '*',
      },
      vpc,
      securityGroups,
    });

    this.apiHandler = apiHandler;

    table.grantReadWriteData(apiHandler);
    props.statsTable.grantReadWriteData(apiHandler);
    fileBucket.grantReadWrite(apiHandler);

    // Grant DynamoDB access for Use Case Builder table
    if (props.useCaseBuilderTable) {
      props.useCaseBuilderTable.grantReadWriteData(apiHandler);
    }

    // Grant S3 access for Transcribe buckets
    if (props.audioBucket && apiHandler.role) {
      props.audioBucket.grantReadWrite(apiHandler);
      // Add IP restrictions for audio bucket
      allowS3AccessWithSourceIpCondition(
        props.audioBucket.bucketName,
        apiHandler.role,
        'write',
        {
          ipv4: props.allowedIpV4AddressRanges || [],
          ipv6: props.allowedIpV6AddressRanges || [],
        }
      );
    }
    if (props.transcriptBucket && apiHandler.role) {
      props.transcriptBucket.grantReadWrite(apiHandler);
      // Add IP restrictions for transcript bucket
      allowS3AccessWithSourceIpCondition(
        props.transcriptBucket.bucketName,
        apiHandler.role,
        'read',
        {
          ipv4: props.allowedIpV4AddressRanges || [],
          ipv6: props.allowedIpV6AddressRanges || [],
        }
      );
    }

    // Grant Transcribe permissions
    apiHandler.role?.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'transcribe:StartTranscriptionJob',
          'transcribe:GetTranscriptionJob',
          'transcribe:ListTranscriptionJobs',
          'transcribe:TagResource',
        ],
        resources: ['*'],
      })
    );

    // Grant Lambda invoke permission for Speech to Speech
    if (props.speechToSpeechTaskFunctionArn) {
      apiHandler.role?.addToPrincipalPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['lambda:InvokeFunction'],
          resources: [props.speechToSpeechTaskFunctionArn],
        })
      );
    }

    // Grant Cognito permissions for Agent Builder
    apiHandler.role?.addToPrincipalPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        resources: [userPool.userPoolArn],
        actions: ['cognito-idp:AdminGetUser'],
      })
    );

    // Grant S3 access for video buckets
    for (const region of Object.keys(props.videoBucketRegionMap)) {
      const bucketName = props.videoBucketRegionMap[region];
      apiHandler.role?.addToPrincipalPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            's3:PutObject',
            's3:GetObject',
            's3:DeleteObject',
            's3:ListBucket',
          ],
          resources: [
            `arn:aws:s3:::${bucketName}`,
            `arn:aws:s3:::${bucketName}/*`,
          ],
        })
      );
    }

    // Lambda functions for direct invocation (not via API Gateway)
    const predictStreamFunction = new NodejsFunction(this, 'PredictStream', {
      runtime: LAMBDA_RUNTIME_NODEJS,
      bundling: bedrockSdkBundling,
      entry: './lambda/predictStream.ts',
      timeout: Duration.minutes(15),
      memorySize: 256,
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        MODEL_REGION: modelRegion,
        MODEL_IDS: JSON.stringify(modelIds),
        IMAGE_GENERATION_MODEL_IDS: JSON.stringify(imageGenerationModelIds),
        VIDEO_GENERATION_MODEL_IDS: JSON.stringify(videoGenerationModelIds),
        BUILTIN_AGENTS_JSON: builtinAgentsJson,
        CUSTOM_AGENTS_JSON: customAgentsJson,
        CROSS_ACCOUNT_BEDROCK_ROLE_ARN: crossAccountBedrockRoleArn ?? '',
        BUCKET_NAME: fileBucket.bucketName,
        KNOWLEDGE_BASE_ID: knowledgeBaseId ?? '',
        ...(props.guardrailIdentify
          ? { GUARDRAIL_IDENTIFIER: props.guardrailIdentify }
          : {}),
        ...(props.guardrailVersion
          ? { GUARDRAIL_VERSION: props.guardrailVersion }
          : {}),
        QUERY_DECOMPOSITION_ENABLED: JSON.stringify(queryDecompositionEnabled),
        RERANKING_MODEL_ID: rerankingModelId ?? '',
      },
      vpc,
      securityGroups,
    });
    fileBucket.grantReadWrite(predictStreamFunction);
    predictStreamFunction.grantInvoke(idPool.authenticatedRole);

    const invokeFlowFunction = new NodejsFunction(this, 'InvokeFlow', {
      runtime: LAMBDA_RUNTIME_NODEJS,
      bundling: bedrockSdkBundling,
      entry: './lambda/invokeFlow.ts',
      timeout: Duration.minutes(15),
      environment: {
        MODEL_REGION: modelRegion,
      },
      vpc,
      securityGroups,
    });
    invokeFlowFunction.grantInvoke(idPool.authenticatedRole);

    const copyVideoJob = new NodejsFunction(this, 'CopyVideoJob', {
      runtime: LAMBDA_RUNTIME_NODEJS,
      bundling: bedrockSdkBundling,
      entry: './lambda/copyVideoJob.ts',
      timeout: Duration.minutes(15),
      memorySize: 512,
      environment: {
        MODEL_REGION: modelRegion,
        MODEL_IDS: JSON.stringify(modelIds),
        IMAGE_GENERATION_MODEL_IDS: JSON.stringify(imageGenerationModelIds),
        VIDEO_GENERATION_MODEL_IDS: JSON.stringify(videoGenerationModelIds),
        VIDEO_BUCKET_REGION_MAP: JSON.stringify(props.videoBucketRegionMap),
        CROSS_ACCOUNT_BEDROCK_ROLE_ARN: crossAccountBedrockRoleArn ?? '',
        BUCKET_NAME: fileBucket.bucketName,
        TABLE_NAME: table.tableName,
      },
      vpc,
      securityGroups,
    });
    for (const region of Object.keys(props.videoBucketRegionMap)) {
      const bucketName = props.videoBucketRegionMap[region];
      copyVideoJob.role?.addToPrincipalPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['s3:GetObject', 's3:DeleteObject', 's3:ListBucket'],
          resources: [
            `arn:aws:s3:::${bucketName}`,
            `arn:aws:s3:::${bucketName}/*`,
          ],
        })
      );
    }
    fileBucket.grantWrite(copyVideoJob);
    table.grantWriteData(copyVideoJob);

    const optimizePromptFunction = new NodejsFunction(
      this,
      'OptimizePromptFunction',
      {
        runtime: LAMBDA_RUNTIME_NODEJS,
        bundling: bedrockSdkBundling,
        entry: './lambda/optimizePrompt.ts',
        timeout: Duration.minutes(15),
        environment: {
          MODEL_REGION: modelRegion,
        },
        vpc,
        securityGroups,
      }
    );
    optimizePromptFunction.grantInvoke(idPool.authenticatedRole);

    // Grant S3 permissions to apiHandler with IP restrictions
    if (apiHandler.role) {
      allowS3AccessWithSourceIpCondition(
        fileBucket.bucketName,
        apiHandler.role,
        'write',
        {
          ipv4: props.allowedIpV4AddressRanges || [],
          ipv6: props.allowedIpV6AddressRanges || [],
        }
      );
      allowS3AccessWithSourceIpCondition(
        fileBucket.bucketName,
        apiHandler.role,
        'read',
        {
          ipv4: props.allowedIpV4AddressRanges || [],
          ipv6: props.allowedIpV6AddressRanges || [],
        }
      );
      // Additional buckets permissions
      if (props.additionalS3Buckets) {
        props.additionalS3Buckets.forEach((bucket) => {
          allowS3AccessWithSourceIpCondition(
            bucket.bucketName,
            apiHandler.role!,
            'read',
            {
              ipv4: props.allowedIpV4AddressRanges || [],
              ipv6: props.allowedIpV6AddressRanges || [],
            }
          );
        });
      }
    }

    if (endpointNames.length > 0) {
      const sagemakerPolicy = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sagemaker:DescribeEndpoint', 'sagemaker:InvokeEndpoint'],
        resources: endpointNames.map(
          (endpointName) =>
            `arn:aws:sagemaker:${endpointName.region}:${Stack.of(this).account}:endpoint/${endpointName.modelId}`
        ),
      });
      apiHandler.role?.addToPrincipalPolicy(sagemakerPolicy);
      predictStreamFunction.role?.addToPrincipalPolicy(sagemakerPolicy);
      invokeFlowFunction.role?.addToPrincipalPolicy(sagemakerPolicy);
    }

    // Grant Kendra permissions if Kendra Index ID is provided
    if (props.kendraIndexId) {
      const kendraIndexArn = `arn:aws:kendra:${Stack.of(this).region}:${Stack.of(this).account}:index/${props.kendraIndexId}`;
      apiHandler.role?.addToPrincipalPolicy(
        new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [kendraIndexArn],
          actions: ['kendra:Query', 'kendra:Retrieve'],
        })
      );
    }

    // Allow downloading files from Knowledge Base data source bucket
    if (props.knowledgeBaseDataSourceBucketName && apiHandler.role) {
      allowS3AccessWithSourceIpCondition(
        props.knowledgeBaseDataSourceBucketName,
        apiHandler.role,
        'read',
        {
          ipv4: props.allowedIpV4AddressRanges || [],
          ipv6: props.allowedIpV6AddressRanges || [],
        }
      );
    }

    // Allow downloading files from RAG data source bucket
    if (props.dataSourceBucketName && apiHandler.role) {
      allowS3AccessWithSourceIpCondition(
        props.dataSourceBucketName,
        apiHandler.role,
        'read',
        {
          ipv4: props.allowedIpV4AddressRanges || [],
          ipv6: props.allowedIpV6AddressRanges || [],
        }
      );
    }

    if (
      typeof crossAccountBedrockRoleArn !== 'string' ||
      crossAccountBedrockRoleArn === ''
    ) {
      const bedrockPolicy = new PolicyStatement({
        effect: Effect.ALLOW,
        resources: ['*'],
        actions: [
          'bedrock:*',
          'logs:*',
          'aws-marketplace:Subscribe',
          'aws-marketplace:Unsubscribe',
          'aws-marketplace:ViewSubscriptions',
        ],
      });
      apiHandler.role?.addToPrincipalPolicy(bedrockPolicy);
      predictStreamFunction.role?.addToPrincipalPolicy(bedrockPolicy);
      invokeFlowFunction.role?.addToPrincipalPolicy(bedrockPolicy);
      optimizePromptFunction.role?.addToPrincipalPolicy(bedrockPolicy);
    } else {
      const logsPolicy = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['logs:*'],
        resources: ['*'],
      });
      const assumeRolePolicy = new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: [crossAccountBedrockRoleArn],
      });
      apiHandler.role?.addToPrincipalPolicy(logsPolicy);
      apiHandler.role?.addToPrincipalPolicy(assumeRolePolicy);
      predictStreamFunction.role?.addToPrincipalPolicy(logsPolicy);
      predictStreamFunction.role?.addToPrincipalPolicy(assumeRolePolicy);
    }

    // API Gateway
    const authorizer = new CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [userPool],
    });

    const commonAuthorizerProps: Partial<MethodOptions> = {
      authorizationType: AuthorizationType.COGNITO,
      authorizer,
    };

    const lambdaIntegration = new LambdaIntegration(apiHandler, {
      proxy: true,
      // Use a single wildcard permission instead of per-method permissions
      // to avoid exceeding the Lambda resource policy size limit (20KB).
      scopePermissionToMethod: false,
    });

    const api = new RestApi(this, 'Api', {
      deployOptions: {
        stageName: 'api',
      },
      defaultIntegration: lambdaIntegration,
      defaultMethodOptions: commonAuthorizerProps,
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowCredentials: true,
      },
      cloudWatchRole: true,
      endpointConfiguration: vpc
        ? {
            types: [EndpointType.PRIVATE],
            vpcEndpoints: [apiGatewayVpcEndpoint!],
          }
        : undefined,
      policy: vpc
        ? new PolicyDocument({
            statements: [apiGatewayVpcEndpoint!].map(
              (e: InterfaceVpcEndpoint) => {
                return new PolicyStatement({
                  effect: Effect.ALLOW,
                  principals: [new AnyPrincipal()],
                  actions: ['execute-api:Invoke'],
                  resources: ['execute-api:/*'],
                  conditions: {
                    StringEquals: {
                      'aws:SourceVpce': e.vpcEndpointId,
                    },
                  },
                });
              }
            ),
          })
        : undefined,
    });

    const errorHeaders = {
      'Access-Control-Allow-Origin': "'*'",
      'Access-Control-Allow-Methods': "'*'",
      'Access-Control-Allow-Credentials': "'true'",
      'Cache-Control': "'no-cache, no-store, must-revalidate'",
    };

    api.addGatewayResponse('Api4XX', {
      type: ResponseType.DEFAULT_4XX,
      responseHeaders: errorHeaders,
    });

    api.addGatewayResponse('Api5XX', {
      type: ResponseType.DEFAULT_5XX,
      responseHeaders: errorHeaders,
    });

    // =========================================================================
    // Compatibility routes for v5 → v5 (monolith) migration
    // =========================================================================
    // v5 previously defined individual API Gateway Resources/Methods across
    // multiple Constructs, each backed by its own Lambda. The monolith
    // replaces all Lambdas with a single apiHandler, but we must preserve
    // the same Resource/Method structure so CloudFormation only updates
    // Integration URIs (mutable) instead of adding/deleting Resources.
    // Without this, CloudFormation's UPDATE_CLEANUP ordering causes a Two
    // Phase Deploy where the Deployment snapshot is taken before old routes
    // are deleted.
    //
    // All methods inherit defaultIntegration and defaultMethodOptions from
    // RestApi. scopePermissionToMethod: false avoids the 20KB Lambda policy
    // size limit by using a single wildcard permission.
    //
    // See:
    //   https://github.com/aws/aws-cdk/issues/14660
    //   https://github.com/aws-cloudformation/cloudformation-coverage-roadmap/issues/623
    //
    // TODO: Remove in v6. Replace with just addProxy().
    // =========================================================================

    // --- Api Construct (v5) ---
    const predict = api.root.addResource('predict');
    predict.addMethod('POST');
    predict.addResource('title').addMethod('POST');

    const chats = api.root.addResource('chats');
    chats.addMethod('POST');
    chats.addMethod('GET');
    const chat = chats.addResource('{chatId}');
    chat.addMethod('GET');
    chat.addMethod('DELETE');
    chat.addResource('title').addMethod('PUT');
    const messages = chat.addResource('messages');
    messages.addMethod('GET');
    messages.addMethod('POST');
    // Explicitly defined because the addProxy() catch-all does not apply to
    // methods of a Resource that is already declared above.
    messages.addMethod('DELETE');
    chat.addResource('feedbacks').addMethod('POST');

    const systemcontexts = api.root.addResource('systemcontexts');
    systemcontexts.addMethod('POST');
    systemcontexts.addMethod('GET');
    const systemcontext = systemcontexts.addResource('{systemContextId}');
    systemcontext.addMethod('DELETE');
    systemcontext.addResource('title').addMethod('PUT');

    const mm = api.root.addResource('meeting-minutes');
    const cp = mm.addResource('custom-prompts');
    cp.addMethod('ANY');
    cp.addResource('{id}').addMethod('ANY');

    const image = api.root.addResource('image');
    image.addResource('generate').addMethod('POST');

    const video = api.root.addResource('video');
    const videoGen = video.addResource('generate');
    videoGen.addMethod('POST');
    videoGen.addMethod('GET');
    videoGen.addResource('{createdDate}').addMethod('DELETE');

    api.root.addResource('web-text').addMethod('GET');

    const shares = api.root.addResource('shares');
    const shareChatId = shares.addResource('chat').addResource('{chatId}');
    shareChatId.addMethod('GET');
    shareChatId.addMethod('POST');
    const shareShareId = shares.addResource('share').addResource('{shareId}');
    shareShareId.addMethod('GET');
    shareShareId.addMethod('DELETE');

    const file = api.root.addResource('file');
    const fileUrl = file.addResource('url');
    fileUrl.addMethod('POST');
    fileUrl.addMethod('GET');
    file.addResource('{fileName}').addMethod('DELETE');

    api.root.addResource('token-usage').addMethod('GET');

    // --- Routes from Rag Construct (v5) ---
    const rag = api.root.addResource('rag');
    rag.addResource('query').addMethod('POST');
    rag.addResource('retrieve').addMethod('POST');

    // --- Routes from RagKnowledgeBase Construct (v5) ---
    const ragKb = api.root.addResource('rag-knowledge-base');
    ragKb.addResource('retrieve').addMethod('POST');

    // --- Routes from UseCaseBuilder Construct (v5) ---
    const usecases = api.root.addResource('usecases');
    usecases.addMethod('POST');
    usecases.addMethod('GET');
    const favoriteUseCase = usecases.addResource('favorite');
    favoriteUseCase.addMethod('GET');
    const usecase = usecases.addResource('{useCaseId}');
    usecase.addMethod('GET');
    usecase.addMethod('PUT');
    usecase.addMethod('DELETE');
    usecase.addResource('favorite').addMethod('PUT');
    usecase.addResource('shared').addMethod('PUT');
    const recentUseCases = usecases.addResource('recent');
    recentUseCases.addMethod('GET');
    recentUseCases.addResource('{useCaseId}').addMethod('PUT');

    // --- Routes from AgentBuilder Construct (v5) ---
    const agents = api.root.addResource('agents');
    agents.addMethod('ANY');
    agents.addResource('{proxy+}').addMethod('ANY');

    // --- Routes from Transcribe Construct (v5) ---
    const transcribe = api.root.addResource('transcribe');
    transcribe.addResource('start').addMethod('POST');
    transcribe.addResource('url').addMethod('POST');
    transcribe.addResource('result').addResource('{jobName}').addMethod('GET');

    // --- Routes from SpeechToSpeech Construct (v5) ---
    api.root.addResource('speech-to-speech').addMethod('POST');

    // Catch-all for any new routes added in the monolith
    api.root.addProxy({
      defaultIntegration: lambdaIntegration,
      defaultMethodOptions: commonAuthorizerProps,
    });

    // Force a new API Gateway deployment.
    // Bump this version when route configuration changes.
    const API_DEPLOYMENT_VERSION = 'v3';
    const deployment = new Deployment(this, 'ApiDeployment', { api });
    deployment.addToLogicalId(API_DEPLOYMENT_VERSION);

    this.api = api;
    this.predictStreamFunction = predictStreamFunction;
    this.invokeFlowFunction = invokeFlowFunction;
    this.optimizePromptFunction = optimizePromptFunction;
    this.modelRegion = modelRegion;
    this.modelIds = modelIds;
    this.imageGenerationModelIds = imageGenerationModelIds;
    this.videoGenerationModelIds = videoGenerationModelIds;
    this.endpointNames = endpointNames;
    this.agents = [];
    this.fileBucket = fileBucket;
  }
}
