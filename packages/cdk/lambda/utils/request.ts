import { RetrievalFilter } from '@aws-sdk/client-bedrock-agent-runtime';
import {
  getDynamicFilters,
  hiddenStaticExplicitFilters,
} from '@generative-ai-use-cases/common';
import { verifyToken } from './auth';

/**
 * The Knowledge Base filters that apply to the caller: the hidden static
 * filters plus the user-attribute (dynamic) filters, from the verified id
 * token. Returns null when the token cannot be verified, and the caller must
 * then deny.
 *
 * Filters a user picks in the UI and AI-derived implicit filters narrow a
 * search; they are not access rules and are not part of this set.
 */
export const callerRetrievalFilters = async (
  idToken: string | undefined
): Promise<RetrievalFilter[] | null> => {
  const payload = await verifyToken(idToken ?? '');
  if (!payload) return null;
  return [...hiddenStaticExplicitFilters, ...getDynamicFilters(payload)];
};

/** Combine filters into the single `RetrievalFilter` Bedrock takes. */
export const combineFilters = (
  filters: RetrievalFilter[]
): RetrievalFilter | undefined => {
  if (filters.length === 0) return undefined;
  if (filters.length === 1) return filters[0];
  return { andAll: filters };
};
