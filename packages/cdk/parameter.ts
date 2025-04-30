import * as cdk from 'aws-cdk-lib';
import { StackInput, stackInputSchema } from './lib/stack-input';

// CDK Context からパラメータを取得する場合
const getContext = (app: cdk.App): StackInput => {
  const params = stackInputSchema.parse(app.node.getAllContext());
  return params;
};

// パラメータを直接定義する場合
const envs: Record<string, Partial<StackInput>> = {
  // 必要に応じて以下をカスタマイズ
  // paramter.ts で無名環境を定義したい場合は以下をアンコメントすると cdk.json の内容が無視され、parameter.ts がより優先されます。
  // '': {
  //   // 無名環境のパラメータ
  //   // デフォルト設定を上書きしたいものは以下に追記
  // },
  dev: {
    selfSignUpEnabled: false,
    modelRegion: "us-west-2",
    modelIds: [
      "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
      "us.anthropic.claude-3-5-haiku-20241022-v1:0",
      "us.anthropic.claude-3-sonnet-20240229-v1:0",
      "us.anthropic.claude-3-haiku-20240307-v1:0",
      "us.amazon.nova-pro-v1:0",
      "us.amazon.nova-lite-v1:0",
      "us.amazon.nova-micro-v1:0"
    ],
    ragKnowledgeBaseEnabled: false,
    ragKnowledgeBaseStandbyReplicas: false,
    ragKnowledgeBaseAdvancedParsing: false,
    ragKnowledgeBaseAdvancedParsingModelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    embeddingModelId: 'amazon.titan-embed-text-v2:0',
    rerankingModelId: "amazon.rerank-v1:0",
    queryDecompositionEnabled: true,
    imageGenerationModelIds: [
      "amazon.nova-canvas-v1:0",
      "amazon.titan-image-generator-v2:0",
      "amazon.titan-image-generator-v1",
      "stability.stable-diffusion-xl-v1"
    ],
    agentEnabled: true,
    searchAgentEnabled: true,
    searchApiKey: "",
    agents: [
      {
        displayName: 'ppt-agent',
        agentId: '51B6DKMLAO',
        aliasId: 'AWGN97G0SA',
      },
      {
        displayName: '画像分類したラベルについて説明する',
        agentId: 'PRTHYWWEZW',
        aliasId: '5MLQ6XBLPC',
      }
    ],
    flows: [
      {
        flowId: 'XCUQVALH1T',
        aliasId: 'R6SWPM7U11',
        flowName: '画像認識',
        description: '画像を入力するとラベルを返す',
      },
      {
        flowId: 'JWVYVGGHOS',
        aliasId: 'IWYEE3SJ5L',
        flowName: '材料から料理を考えるマン',
        description: '食材を2つ入力すると料理を考えてくれる',
      }
    ],
    // allowedIpV4AddressRanges: ["103.4.10.234/32", "90.149.156.252/32"],
    // samlAuthEnabled: true,
    // samlCognitoDomainName: "genu-murakami.auth.ap-northeast-1.amazoncognito.com",
    // samlCognitoFederatedIdentityProviderName: "ADFS",
  },
  staging: {
    // selfSignUpEnabled: false,
    // modelRegion: "us-west-2",
    // modelIds: [
    //   "us.anthropic.claude-3-5-sonnet-20241022-v2:0",
    //   "us.anthropic.claude-3-5-haiku-20241022-v1:0",
    //   "us.anthropic.claude-3-sonnet-20240229-v1:0",
    //   "us.anthropic.claude-3-haiku-20240307-v1:0",
    //   "us.amazon.nova-pro-v1:0",
    //   "us.amazon.nova-lite-v1:0",
    //   "us.amazon.nova-micro-v1:0"
    // ],
    // ragKnowledgeBaseEnabled: true,
    // ragKnowledgeBaseStandbyReplicas: false,
    // ragKnowledgeBaseAdvancedParsing: true,
    // ragKnowledgeBaseAdvancedParsingModelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    // embeddingModelId: 'amazon.titan-embed-text-v2:0',
    // rerankingModelId: "amazon.rerank-v1:0",
    // queryDecompositionEnabled: true,
  },
  prod: {
    // 本番環境のパラメータ
  },
  // 他環境も必要に応じてカスタマイズ
};

// 後方互換性のため、CDK Context > parameter.ts の順でパラメータを取得する
export const getParams = (app: cdk.App): StackInput => {
  // デフォルトでは CDK Context からパラメータを取得する
  let params = getContext(app);

  // env が envs で定義したものにマッチ場合は、envs のパラメータを context よりも優先して使用する
  if (envs[params.env]) {
    params = stackInputSchema.parse({
      ...envs[params.env],
      env: params.env,
    });
  }

  return params;
};
