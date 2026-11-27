import { InvokeWithResponseStreamCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { PredictRequest } from '../../../@types/chat';
import { fetchAuthSession } from 'aws-amplify/auth';
import useSettings from '../settings/useSettings';

const usePredict = () => {
  const { settings } = useSettings();

  return {
    predictStream: async function* (req: PredictRequest) {
      const region = settings?.region;
      const userPoolId = settings?.userPoolId;
      const idPoolId = settings?.identityPoolId ?? '';
      const providerName = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;

      const session = await fetchAuthSession();
      const lambda = new LambdaClient({
        region,
        credentials: fromCognitoIdentityPool({
          clientConfig: { region },
          identityPoolId: idPoolId,
          logins: {
            [providerName]: session.tokens?.idToken?.toString() ?? '',
          },
        }),
      });

      const res = await lambda.send(
        new InvokeWithResponseStreamCommand({
          FunctionName: settings?.lambdaArn,
          Payload: JSON.stringify(req),
        }),
      );
      const events = res.EventStream;
      if (!events) {
        return;
      }
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

export default usePredict;
