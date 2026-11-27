import * as lambda from 'aws-cdk-lib/aws-lambda';

export const LAMBDA_RUNTIME_NODEJS = lambda.Runtime.NODEJS_22_X;

export const TAG_KEY = 'GenU';

/**
 * Key prefix the RAG Knowledge Base data source indexes. Source documents are
 * downloadable only under it.
 */
export const KNOWLEDGE_BASE_DATA_SOURCE_PREFIX = 'docs/';

/** Key prefix of the documents the Kendra S3 data source indexes. */
export const KENDRA_DATA_SOURCE_PREFIX = 'docs/';

/**
 * Key pattern of agent output files in the file bucket (the AgentCore runtimes
 * write `users/<sub>/agent-outputs/<uuid>/<name>`).
 */
export const AGENT_OUTPUT_KEY_PATTERN = 'users/*/agent-outputs/*';

/**
 * Condition on the agent output write grants: only create-only puts
 * (`If-None-Match: *`), so a runtime can never overwrite an existing file,
 * whoever's prefix it is under.
 */
export const AGENT_OUTPUT_CREATE_ONLY_CONDITION = {
  Null: { 's3:if-none-match': 'false' },
};

/**
 * SSM parameter through which the main stack tells the AgentCore runtimes,
 * deployed earlier in their own stack, which user pool and file bucket to use.
 */
export const agentCoreRuntimeConfigParameterName = (env: string): string =>
  `/generative-ai-use-cases/agent-core-runtime-config${env ? `/${env}` : ''}`;
