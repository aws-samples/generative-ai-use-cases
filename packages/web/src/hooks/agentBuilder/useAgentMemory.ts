import { useCallback, useState } from 'react';
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { fetchAuthSession } from 'aws-amplify/auth';
import { getRegionFromArn } from '../../utils/arnUtils';

const region = import.meta.env.VITE_APP_REGION as string;
const identityPoolId = import.meta.env.VITE_APP_IDENTITY_POOL_ID as string;
const userPoolId = import.meta.env.VITE_APP_USER_POOL_ID as string;

/** Whether agents can remember users at all. */
export const agentMemoryAvailable =
  import.meta.env.VITE_APP_AGENT_CORE_MEMORY_ENABLED === 'true';

export type AgentMemoryRecord = {
  id: string;
  text: string;
  createdAt: string;
};

export type AgentMemories = {
  facts: AgentMemoryRecord[];
  preferences: AgentMemoryRecord[];
  summaries: AgentMemoryRecord[];
};

type MemoryAction = 'list' | 'delete' | 'delete_all';

/**
 * What an agent remembers about the signed-in user, and the means to forget it.
 *
 * The runtime answers these requests itself, for the user of the id token it
 * verifies.
 */
const useAgentMemory = (
  agentRuntimeArn: string | undefined,
  agentId: string
) => {
  const [memories, setMemories] = useState<AgentMemories | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async (action: MemoryAction, recordId?: string) => {
      if (!agentRuntimeArn) {
        throw new Error('Agent Builder runtime is not configured');
      }
      // The agent id says which agent's memory, never whose: that comes from
      // the id token, which the runtime verifies.
      const token = (await fetchAuthSession()).tokens?.idToken?.toString();
      if (!token) {
        throw new Error('User is not authenticated');
      }
      const client = new BedrockAgentCoreClient({
        region: getRegionFromArn(agentRuntimeArn) || region,
        credentials: fromCognitoIdentityPool({
          clientConfig: { region },
          identityPoolId,
          logins: {
            [`cognito-idp.${region}.amazonaws.com/${userPoolId}`]: token,
          },
        }),
      });
      const res = await client.send(
        new InvokeAgentRuntimeCommand({
          agentRuntimeArn,
          qualifier: 'DEFAULT',
          payload: JSON.stringify({
            memory_action: action,
            agent_id: agentId,
            ...(recordId ? { memory_record_id: recordId } : {}),
            id_token: token,
          }),
        })
      );
      const text = (await res.response?.transformToString()) ?? '';
      const body = JSON.parse(text || '{}');
      if (body.error) {
        throw new Error(body.error);
      }
      // A request the runtime refused (for example an id token it could not
      // verify) comes back as an assistant message instead
      if (body.message) {
        throw new Error(
          body.message.content?.[0]?.text ?? 'Memory request failed'
        );
      }
      return body;
    },
    [agentRuntimeArn, agentId]
  );

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const load = useCallback(
    () =>
      run(async () => {
        const body = await call('list');
        setMemories(body.memories as AgentMemories);
      }),
    [call, run]
  );

  const remove = useCallback(
    (recordId: string) =>
      run(async () => {
        await call('delete', recordId);
        // Listing again right away can still return the record, so drop it
        // here rather than read the list back
        setMemories((current) =>
          current
            ? {
                facts: current.facts.filter((m) => m.id !== recordId),
                preferences: current.preferences.filter(
                  (m) => m.id !== recordId
                ),
                summaries: current.summaries.filter((m) => m.id !== recordId),
              }
            : current
        );
      }),
    [call, run]
  );

  const removeAll = useCallback(
    () =>
      run(async () => {
        await call('delete_all');
        setMemories({ facts: [], preferences: [], summaries: [] });
      }),
    [call, run]
  );

  return { memories, loading, error, load, remove, removeAll };
};

export default useAgentMemory;
