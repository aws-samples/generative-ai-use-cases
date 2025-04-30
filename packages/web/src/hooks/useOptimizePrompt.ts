import { MODELS } from './useModel';
import { fetchAuthSession } from 'aws-amplify/auth';
import {
  LambdaClient,
  InvokeWithResponseStreamCommand,
} from '@aws-sdk/client-lambda';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import { OptimizePromptRequest } from 'generative-ai-use-cases';
import { useTranslation } from 'react-i18next';

// Supported regions are available at the following page
// https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-management-optimize.html
export const SUPPORTED_REGIONS = [
  'us-east-1',
  'us-west-2',
  'ap-south-1',
  'ap-southeast-2',
  'ca-central-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'sa-east-1',
];

export const SUPPORTED_MODELS = [
  'amazon.nova-lite-v1:0',
  'amazon.nova-micro-v1:0',
  'amazon.nova-pro-v1:0',
  'amazon.titan-text-premier-v1:0',
  'anthropic.claude-3-haiku-20240307-v1:0',
  'anthropic.claude-3-opus-20240229-v1:0',
  'anthropic.claude-3-sonnet-20240229-v1:0',
  'anthropic.claude-3-5-haiku-20241022-v1:0',
  'anthropic.claude-3-5-sonnet-20241022-v2:0',
  'anthropic.claude-3-5-sonnet-20240620-v1:0',
  'meta.llama3-70b-instruct-v1:0',
  'meta.llama3-1-70b-instruct-v1:0',
  'mistral.mistral-large-2402-v1:0',
];

const modelRegion = import.meta.env.VITE_APP_MODEL_REGION;
const { modelIds } = MODELS;
const supportedModelIds = modelIds.filter((m: string) =>
  SUPPORTED_MODELS.includes(m)
);

export const optimizePromptEnabled =
  SUPPORTED_REGIONS.includes(modelRegion) && supportedModelIds.length > 0;

const useOptimizePrompt = () => {
  const { t } = useTranslation();

  return {
    optimizePrompt: async function* (req: OptimizePromptRequest) {
      const token = (await fetchAuthSession()).tokens?.idToken?.toString();
      if (!token) {
        throw new Error(t('common.notAuthenticated'));
      }

      const region = import.meta.env.VITE_APP_REGION;
      const userPoolId = import.meta.env.VITE_APP_USER_POOL_ID;
      const idPoolId = import.meta.env.VITE_APP_IDENTITY_POOL_ID;
      const cognito = new CognitoIdentityClient({ region });
      const providerName = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;
      const lambda = new LambdaClient({
        region,
        credentials: fromCognitoIdentityPool({
          client: cognito,
          identityPoolId: idPoolId,
          logins: {
            [providerName]: token,
          },
        }),
      });

      const res = await lambda.send(
        new InvokeWithResponseStreamCommand({
          FunctionName: import.meta.env.VITE_APP_OPTIMIZE_PROMPT_FUNCTION_ARN,
          Payload: JSON.stringify(req),
        })
      );
      const events = res.EventStream!;

      for await (const event of events) {
        if (event.PayloadChunk) {
          yield new TextDecoder('utf-8').decode(event.PayloadChunk.Payload);
        }

        if (event.InvokeComplete) {
          break;
        }
      }
    },
    supportedModelIds,
  };
};

export default useOptimizePrompt;
