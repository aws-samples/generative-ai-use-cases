import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  Auth,
  Api,
  Web,
  Database,
  Rag,
  RagKnowledgeBase,
  Transcribe,
  CommonWebAcl,
  SpeechToSpeech,
} from './construct';
import { CfnWebACLAssociation } from 'aws-cdk-lib/aws-wafv2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Agent } from 'generative-ai-use-cases';
import { UseCaseBuilder } from './construct/use-case-builder';
import { ProcessedStackInput } from './stack-input';

export interface GenerativeAiUseCasesStackProps extends StackProps {
  readonly params: ProcessedStackInput;
  // RAG Knowledge Base
  readonly knowledgeBaseId?: string;
  readonly knowledgeBaseDataSourceBucketName?: string;
  // Agent
  readonly agents?: Agent[];
  // Video Generation
  readonly videoBucketRegionMap: Record<string, string>;
  // Guardrail
  readonly guardrailIdentifier?: string;
  readonly guardrailVersion?: string;
  // WAF
  readonly webAclId?: string;
  // Custom Domain
  readonly cert?: ICertificate;
}

export class GenerativeAiUseCasesStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(
    scope: Construct,
    id: string,
    props: GenerativeAiUseCasesStackProps
  ) {
    super(scope, id, props);
    process.env.overrideWarningsEnabled = 'false';

    const params = props.params;

    // Auth
    const auth = new Auth(this, 'Auth', {
      selfSignUpEnabled: params.selfSignUpEnabled,
      allowedIpV4AddressRanges: params.allowedIpV4AddressRanges,
      allowedIpV6AddressRanges: params.allowedIpV6AddressRanges,
      allowedSignUpEmailDomains: params.allowedSignUpEmailDomains,
      samlAuthEnabled: params.samlAuthEnabled,
    });

    // Database
    const database = new Database(this, 'Database');

    // API
    const api = new Api(this, 'API', {
      modelRegion: params.modelRegion,
      modelIds: params.modelIds,
      imageGenerationModelIds: params.imageGenerationModelIds,
      videoGenerationModelIds: params.videoGenerationModelIds,
      videoBucketRegionMap: props.videoBucketRegionMap,
      endpointNames: params.endpointNames,
      customAgents: params.agents,
      queryDecompositionEnabled: params.queryDecompositionEnabled,
      rerankingModelId: params.rerankingModelId,
      crossAccountBedrockRoleArn: params.crossAccountBedrockRoleArn,

      userPool: auth.userPool,
      idPool: auth.idPool,
      userPoolClient: auth.client,
      table: database.table,
      knowledgeBaseId: params.ragKnowledgeBaseId || props.knowledgeBaseId,
      agents: props.agents,
      guardrailIdentify: props.guardrailIdentifier,
      guardrailVersion: props.guardrailVersion,
    });

    // WAF
    if (
      params.allowedIpV4AddressRanges ||
      params.allowedIpV6AddressRanges ||
      params.allowedCountryCodes
    ) {
      const regionalWaf = new CommonWebAcl(this, 'RegionalWaf', {
        scope: 'REGIONAL',
        allowedIpV4AddressRanges: params.allowedIpV4AddressRanges,
        allowedIpV6AddressRanges: params.allowedIpV6AddressRanges,
        allowedCountryCodes: params.allowedCountryCodes,
      });
      new CfnWebACLAssociation(this, 'ApiWafAssociation', {
        resourceArn: api.api.deploymentStage.stageArn,
        webAclArn: regionalWaf.webAclArn,
      });
      new CfnWebACLAssociation(this, 'UserPoolWafAssociation', {
        resourceArn: auth.userPool.userPoolArn,
        webAclArn: regionalWaf.webAclArn,
      });
    }

    // SpeechToSpeech (for bidirectional communication)
    const speechToSpeech = new SpeechToSpeech(this, 'SpeechToSpeech', {
      envSuffix: params.env,
      api: api.api,
      userPool: auth.userPool,
      speechToSpeechModelIds: params.speechToSpeechModelIds,
      crossAccountBedrockRoleArn: params.crossAccountBedrockRoleArn,
    });

    // Web Frontend
    const web = new Web(this, 'Api', {
      // Auth
      userPoolId: auth.userPool.userPoolId,
      userPoolClientId: auth.client.userPoolClientId,
      idPoolId: auth.idPool.identityPoolId,
      selfSignUpEnabled: params.selfSignUpEnabled,
      samlAuthEnabled: params.samlAuthEnabled,
      samlCognitoDomainName: params.samlCognitoDomainName,
      samlCognitoFederatedIdentityProviderName:
        params.samlCognitoFederatedIdentityProviderName,
      // Backend
      apiEndpointUrl: api.api.url,
      predictStreamFunctionArn: api.predictStreamFunction.functionArn,
      ragEnabled: params.ragEnabled,
      ragKnowledgeBaseEnabled: params.ragKnowledgeBaseEnabled,
      agentEnabled: params.agentEnabled || params.agents.length > 0,
      flows: params.flows,
      flowStreamFunctionArn: api.invokeFlowFunction.functionArn,
      optimizePromptFunctionArn: api.optimizePromptFunction.functionArn,
      webAclId: props.webAclId,
      modelRegion: api.modelRegion,
      modelIds: api.modelIds,
      imageGenerationModelIds: api.imageGenerationModelIds,
      videoGenerationModelIds: api.videoGenerationModelIds,
      endpointNames: api.endpointNames,
      agentNames: api.agentNames,
      inlineAgents: params.inlineAgents,
      useCaseBuilderEnabled: params.useCaseBuilderEnabled,
      speechToSpeechNamespace: speechToSpeech.namespace,
      speechToSpeechEventApiEndpoint: speechToSpeech.eventApiEndpoint,
      speechToSpeechModelIds: params.speechToSpeechModelIds,
      // Frontend
      hiddenUseCases: params.hiddenUseCases,
      // Custom Domain
      cert: props.cert,
      hostName: params.hostName,
      domainName: params.domainName,
      hostedZoneId: params.hostedZoneId,
    });

    // RAG
    if (params.ragEnabled) {
      const rag = new Rag(this, 'Rag', {
        envSuffix: params.env,
        kendraIndexLanguage: params.kendraIndexLanguage,
        kendraIndexArnInCdkContext: params.kendraIndexArn,
        kendraDataSourceBucketName: params.kendraDataSourceBucketName,
        kendraIndexScheduleEnabled: params.kendraIndexScheduleEnabled,
        kendraIndexScheduleCreateCron: params.kendraIndexScheduleCreateCron,
        kendraIndexScheduleDeleteCron: params.kendraIndexScheduleDeleteCron,
        userPool: auth.userPool,
        api: api.api,
      });

      // Allow downloading files from the File API to the data source Bucket
      // If you are importing existing Kendra, there is a possibility that the data source is not S3
      // In that case, rag.dataSourceBucketName will be undefined and the permission will not be granted
      if (rag.dataSourceBucketName) {
        api.allowDownloadFile(rag.dataSourceBucketName);
      }
    }

    // RAG Knowledge Base
    if (params.ragKnowledgeBaseEnabled) {
      const knowledgeBaseId =
        params.ragKnowledgeBaseId || props.knowledgeBaseId;
      if (knowledgeBaseId) {
        new RagKnowledgeBase(this, 'RagKnowledgeBase', {
          modelRegion: params.modelRegion,
          crossAccountBedrockRoleArn: params.crossAccountBedrockRoleArn,
          knowledgeBaseId: knowledgeBaseId,
          userPool: auth.userPool,
          api: api.api,
        });
        // Allow downloading files from the File API to the data source Bucket
        if (props.knowledgeBaseDataSourceBucketName) {
          api.allowDownloadFile(props.knowledgeBaseDataSourceBucketName);
        }
      }
    }

    // Usecase builder
    if (params.useCaseBuilderEnabled) {
      new UseCaseBuilder(this, 'UseCaseBuilder', {
        userPool: auth.userPool,
        api: api.api,
      });
    }

    // Transcribe
    new Transcribe(this, 'Transcribe', {
      userPool: auth.userPool,
      idPool: auth.idPool,
      api: api.api,
    });

    // Cfn Outputs
    new CfnOutput(this, 'Region', {
      value: this.region,
    });

    if (params.hostName && params.domainName) {
      new CfnOutput(this, 'WebUrl', {
        value: `https://${params.hostName}.${params.domainName}`,
      });
    } else {
      new CfnOutput(this, 'WebUrl', {
        value: `https://${web.distribution.domainName}`,
      });
    }

    new CfnOutput(this, 'ApiEndpoint', {
      value: api.api.url,
    });

    new CfnOutput(this, 'UserPoolId', { value: auth.userPool.userPoolId });

    new CfnOutput(this, 'UserPoolClientId', {
      value: auth.client.userPoolClientId,
    });

    new CfnOutput(this, 'IdPoolId', { value: auth.idPool.identityPoolId });

    new CfnOutput(this, 'PredictStreamFunctionArn', {
      value: api.predictStreamFunction.functionArn,
    });

    new CfnOutput(this, 'OptimizePromptFunctionArn', {
      value: api.optimizePromptFunction.functionArn,
    });

    new CfnOutput(this, 'InvokeFlowFunctionArn', {
      value: api.invokeFlowFunction.functionArn,
    });

    new CfnOutput(this, 'Flows', {
      value: Buffer.from(JSON.stringify(params.flows)).toString('base64'),
    });

    new CfnOutput(this, 'RagEnabled', {
      value: params.ragEnabled.toString(),
    });

    new CfnOutput(this, 'RagKnowledgeBaseEnabled', {
      value: params.ragKnowledgeBaseEnabled.toString(),
    });

    new CfnOutput(this, 'AgentEnabled', {
      value: (params.agentEnabled || params.agents.length > 0).toString(),
    });

    new CfnOutput(this, 'SelfSignUpEnabled', {
      value: params.selfSignUpEnabled.toString(),
    });

    new CfnOutput(this, 'ModelRegion', {
      value: api.modelRegion,
    });

    new CfnOutput(this, 'ModelIds', {
      value: JSON.stringify(api.modelIds),
    });

    new CfnOutput(this, 'ImageGenerateModelIds', {
      value: JSON.stringify(api.imageGenerationModelIds),
    });

    new CfnOutput(this, 'VideoGenerateModelIds', {
      value: JSON.stringify(api.videoGenerationModelIds),
    });

    new CfnOutput(this, 'EndpointNames', {
      value: JSON.stringify(api.endpointNames),
    });

    new CfnOutput(this, 'SamlAuthEnabled', {
      value: params.samlAuthEnabled.toString(),
    });

    new CfnOutput(this, 'SamlCognitoDomainName', {
      value: params.samlCognitoDomainName ?? '',
    });

    new CfnOutput(this, 'SamlCognitoFederatedIdentityProviderName', {
      value: params.samlCognitoFederatedIdentityProviderName ?? '',
    });

    new CfnOutput(this, 'AgentNames', {
      value: Buffer.from(JSON.stringify(api.agentNames)).toString('base64'),
    });

    new CfnOutput(this, 'InlineAgents', {
      value: params.inlineAgents.toString(),
    });

    new CfnOutput(this, 'UseCaseBuilderEnabled', {
      value: params.useCaseBuilderEnabled.toString(),
    });

    new CfnOutput(this, 'HiddenUseCases', {
      value: JSON.stringify(params.hiddenUseCases),
    });

    new CfnOutput(this, 'SpeechToSpeechNamespace', {
      value: speechToSpeech.namespace,
    });

    new CfnOutput(this, 'SpeechToSpeechEventApiEndpoint', {
      value: speechToSpeech.eventApiEndpoint,
    });

    new CfnOutput(this, 'SpeechToSpeechModelIds', {
      value: JSON.stringify(params.speechToSpeechModelIds),
    });

    this.userPool = auth.userPool;
    this.userPoolClient = auth.client;

    this.exportValue(this.userPool.userPoolId);
    this.exportValue(this.userPoolClient.userPoolClientId);
  }
}
