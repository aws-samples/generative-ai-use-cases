#!/bin/bash

set -eu

# Get env from command lineargument (optional)
if [ -n "${1:-}" ]; then
    env=$1
    echo "Using environment: $env"
else
    # Parse packages/cdk/cdk.json and get context.env if env is not provided
    echo "No environment provided, using context.env"
    echo "If you want to specify the environment, please run with argument (i.e. npm run web:devw --env=<env>)"
    env=$(cat packages/cdk/cdk.json | jq -r '.context.env')
fi

STACK_NAME="GenerativeAiUseCasesStack${env}"
echo "Using stack output for $STACK_NAME"

function extract_value {
    echo $1 | jq -r ".Stacks[0].Outputs[] | select(.OutputKey==\"$2\") | .OutputValue"
}

stack_output=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --output json)

export VITE_APP_API_ENDPOINT=$(extract_value "$stack_output" 'ApiEndpoint')
export VITE_APP_REGION=$(extract_value "$stack_output" 'Region')
export VITE_APP_USER_POOL_ID=$(extract_value "$stack_output" 'UserPoolId')
export VITE_APP_USER_POOL_CLIENT_ID=$(extract_value "$stack_output" 'UserPoolClientId')
export VITE_APP_IDENTITY_POOL_ID=$(extract_value "$stack_output" 'IdPoolId')
export VITE_APP_PREDICT_STREAM_FUNCTION_ARN=$(extract_value "$stack_output" PredictStreamFunctionArn)
export VITE_APP_FLOW_STREAM_FUNCTION_ARN=$(extract_value "$stack_output" 'InvokeFlowFunctionArn')
export VITE_APP_FLOWS=$(extract_value "$stack_output" 'Flows' | base64 -d)
export VITE_APP_RAG_ENABLED=$(extract_value "$stack_output" RagEnabled)
export VITE_APP_RAG_KNOWLEDGE_BASE_ENABLED=$(extract_value "$stack_output" RagKnowledgeBaseEnabled)
export VITE_APP_RAG_KNOWLEDGE_BASE_STORAGE_TYPE=$(extract_value "$stack_output" RagKnowledgeBaseStorageType)
export VITE_APP_AGENT_ENABLED=$(extract_value "$stack_output" AgentEnabled)
export VITE_APP_SELF_SIGN_UP_ENABLED=$(extract_value "$stack_output" SelfSignUpEnabled)
export VITE_APP_MODEL_REGION=$(extract_value "$stack_output" ModelRegion)
export VITE_APP_MODEL_IDS=$(extract_value "$stack_output" ModelIds)
export VITE_APP_IMAGE_MODEL_IDS=$(extract_value "$stack_output" ImageGenerateModelIds)
export VITE_APP_VIDEO_MODEL_IDS=$(extract_value "$stack_output" VideoGenerateModelIds)
export VITE_APP_ENDPOINT_NAMES=$(extract_value "$stack_output" EndpointNames)
export VITE_APP_SAMLAUTH_ENABLED=$(extract_value "$stack_output" SamlAuthEnabled)
export VITE_APP_SAML_COGNITO_DOMAIN_NAME=$(extract_value "$stack_output" SamlCognitoDomainName)
export VITE_APP_SAML_COGNITO_FEDERATED_IDENTITY_PROVIDER_NAME=$(extract_value "$stack_output" SamlCognitoFederatedIdentityProviderName)
export VITE_APP_AGENTS=$(extract_value "$stack_output" Agents | base64 -d)
export VITE_APP_INLINE_AGENTS=$(extract_value "$stack_output" InlineAgents)
export VITE_APP_USE_CASE_BUILDER_ENABLED=$(extract_value "$stack_output" UseCaseBuilderEnabled)
export VITE_APP_OPTIMIZE_PROMPT_FUNCTION_ARN=$(extract_value "$stack_output" OptimizePromptFunctionArn)
export VITE_APP_HIDDEN_USE_CASES=$(extract_value "$stack_output" HiddenUseCases)
export VITE_APP_SPEECH_TO_SPEECH_NAMESPACE=$(extract_value "$stack_output" SpeechToSpeechNamespace)
export VITE_APP_SPEECH_TO_SPEECH_EVENT_API_ENDPOINT=$(extract_value "$stack_output" SpeechToSpeechEventApiEndpoint)
export VITE_APP_SPEECH_TO_SPEECH_MODEL_IDS=$(extract_value "$stack_output" SpeechToSpeechModelIds)
export VITE_APP_MCP_ENABLED=$(extract_value "$stack_output" McpEnabled)
export VITE_APP_MCP_ENDPOINT=$(extract_value "$stack_output" McpEndpoint)
export VITE_APP_AGENT_CORE_ENABLED=$(extract_value "$stack_output" AgentCoreEnabled)
export VITE_APP_AGENT_CORE_GENERIC_RUNTIME=$(extract_value "$stack_output" AgentCoreGenericRuntime)
export VITE_APP_AGENT_CORE_AGENT_BUILDER_ENABLED=$(extract_value "$stack_output" AgentCoreAgentBuilderEnabled)
export VITE_APP_AGENT_CORE_AGENT_BUILDER_RUNTIME=$(extract_value "$stack_output" AgentCoreAgentBuilderRuntime)
export VITE_APP_AGENT_CORE_EXTERNAL_RUNTIMES=$(extract_value "$stack_output" AgentCoreExternalRuntimes)
export VITE_APP_MCP_SERVERS_CONFIG=$(extract_value "$stack_output" McpServersConfig)
if [ -f "packages/cdk/branding.json" ]; then
    export VITE_APP_BRANDING_LOGO_PATH=$(cat packages/cdk/branding.json | jq -r '.logoPath // ""')
    export VITE_APP_BRANDING_TITLE=$(cat packages/cdk/branding.json | jq -r '.title // ""')
else
    export VITE_APP_BRANDING_LOGO_PATH=""
    export VITE_APP_BRANDING_TITLE=""
fi

# Backend environment variables
export MODEL_REGION=$(extract_value "$stack_output" ModelRegion)
export MODEL_IDS=$(extract_value "$stack_output" ModelIds)
export IMAGE_GENERATION_MODEL_IDS=$(extract_value "$stack_output" ImageGenerateModelIds)
export VIDEO_GENERATION_MODEL_IDS=$(extract_value "$stack_output" VideoGenerateModelIds)
export SPEECH_TO_SPEECH_MODEL_IDS=$(extract_value "$stack_output" SpeechToSpeechModelIds)
export TABLE_NAME=$(extract_value "$stack_output" TableName)
export STATS_TABLE_NAME=$(extract_value "$stack_output" StatsTableName)
export BUCKET_NAME=$(extract_value "$stack_output" BucketName)
export USER_POOL_ID=$(extract_value "$stack_output" UserPoolId)
export USER_POOL_CLIENT_ID=$(extract_value "$stack_output" UserPoolClientId)
export KNOWLEDGE_BASE_ID=$(extract_value "$stack_output" KnowledgeBaseId || echo "")
export INDEX_ID=$(extract_value "$stack_output" IndexId || echo "")
export USECASE_TABLE_NAME=$(extract_value "$stack_output" UseCaseTableName || echo "")
export USECASE_ID_INDEX_NAME=$(extract_value "$stack_output" UseCaseIdIndexName || echo "")
export AUDIO_BUCKET_NAME=$(extract_value "$stack_output" AudioBucketName || echo "")
export TRANSCRIPT_BUCKET_NAME=$(extract_value "$stack_output" TranscriptBucketName || echo "")
export BUILTIN_AGENTS_JSON=$(extract_value "$stack_output" Agents | base64 --decode || echo "[]")
export CUSTOM_AGENTS_JSON="[]"
export CROSS_ACCOUNT_BEDROCK_ROLE_ARN=""
export VIDEO_BUCKET_REGION_MAP="{}"
export QUERY_DECOMPOSITION_ENABLED=$(extract_value "$stack_output" QueryDecompositionEnabled || echo "false")
export RERANKING_MODEL_ID=$(extract_value "$stack_output" RerankingModelId || echo "")
export LANGUAGE="ja"
export SPEECH_TO_SPEECH_TASK_FUNCTION_ARN=""
export USER_POOL_PROXY_ENDPOINT=""
