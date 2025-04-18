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
export VITE_APP_AGENT_NAMES=$(extract_value "$stack_output" AgentNames | base64 -d)
export VITE_APP_INLINE_AGENTS=$(extract_value "$stack_output" InlineAgents)
export VITE_APP_USE_CASE_BUILDER_ENABLED=$(extract_value "$stack_output" UseCaseBuilderEnabled)
export VITE_APP_OPTIMIZE_PROMPT_FUNCTION_ARN=$(extract_value "$stack_output" OptimizePromptFunctionArn)
export VITE_APP_HIDDEN_USE_CASES=$(extract_value "$stack_output" HiddenUseCases)
export VITE_APP_SPEECH_TO_SPEECH_NAMESPACE=$(extract_value "$stack_output" SpeechToSpeechNamespace)
export VITE_APP_SPEECH_TO_SPEECH_EVENT_API_ENDPOINT=$(extract_value "$stack_output" SpeechToSpeechEventApiEndpoint)
export VITE_APP_SPEECH_TO_SPEECH_MODEL_IDS=$(extract_value "$stack_output" SpeechToSpeechModelIds)
