import { fetchAuthSession } from 'aws-amplify/auth';
import {
  LambdaClient,
  InvokeWithResponseStreamCommand,
} from '@aws-sdk/client-lambda';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import { FlowRequest } from 'generative-ai-use-cases';
import { useTranslation } from 'react-i18next';

export type DocumentType =
  | null
  | boolean
  | number
  | string
  | DocumentType[]
  | {
      [prop: string]: DocumentType;
    };

export type FlowResponse = {
  content: string;
};

const useFlowApi = () => {
  const { t } = useTranslation();

  return {
    invokeFlowStream: async function* (req: FlowRequest) {
      const token = (await fetchAuthSession()).tokens?.idToken?.toString();
      if (!token) {
        throw new Error(t('common.error.notAuthenticated'));
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
          FunctionName: import.meta.env.VITE_APP_FLOW_STREAM_FUNCTION_ARN,
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
  };
};

export default useFlowApi;
