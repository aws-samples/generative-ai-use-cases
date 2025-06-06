import { useState, useEffect } from 'react';
import {
  BedrockAgent,
  KnowledgeBaseSummary,
} from '@aws-sdk/client-bedrock-agent';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import { fetchAuthSession } from 'aws-amplify/auth';

export const useKnowledgeBases = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseSummary[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const region = import.meta.env.VITE_APP_REGION;
    const userPoolId = import.meta.env.VITE_APP_USER_POOL_ID;
    const idPoolId = import.meta.env.VITE_APP_IDENTITY_POOL_ID;
    const cognito = new CognitoIdentityClient({ region });
    const providerName = `cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    const fetchKnowledgeBases = async () => {
      try {
        const token = (await fetchAuthSession()).tokens?.idToken?.toString();
        if (!token) {
          throw new Error('Not authenticated');
        }
        const client = new BedrockAgent({
          region: region,
          credentials: fromCognitoIdentityPool({
            client: cognito,
            identityPoolId: idPoolId,
            logins: {
              [providerName]: token,
            },
          }),
        });

        //let nextToken: string | undefined;
        //const allKnowledgeBases: KnowledgeBaseSummary[] = [];

        const response = await client.listKnowledgeBases({
          maxResults: 10,
        });
        const allKnowledgeBases = response.knowledgeBaseSummaries || [];
        setKnowledgeBases(allKnowledgeBases);
      } catch (err) {
        console.error('Error fetching knowledge bases:', err);
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to fetch knowledge bases')
        );
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgeBases();
  }, [knowledgeBases]);

  return {
    knowledgeBaseIds: knowledgeBases.map((kb) => kb.knowledgeBaseId || ''),
    loading,
    error,
  };
};
