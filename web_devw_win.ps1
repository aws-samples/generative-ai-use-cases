# Stop on errors
$ErrorActionPreference = "Stop"

# Get environment and profile from command line arguments
[string]$environment = $null
[string]$profile = "default"

# Check if environment was provided as a parameter
for ($i = 0; $i -lt $args.Count; $i++) {
    if ($args[$i] -eq "-environment" -or $args[$i] -eq "--environment" -or $args[$i] -eq "-env" -or $args[$i] -eq "--env") {
        if ($i + 1 -lt $args.Count) {
            $environment = $args[$i + 1]
            $i++
        }
    }
    elseif ($args[$i] -eq "-profile" -or $args[$i] -eq "--profile") {
        if ($i + 1 -lt $args.Count) {
            $profile = $args[$i + 1]
            $i++
        }
    }
}

if ([string]::IsNullOrEmpty($environment)) {
    # Parse packages/cdk/cdk.json and get context.env if environment is not provided
    Write-Host "No environment provided, using context.env"
    Write-Host "If you want to specify the environment, please run with argument -env <env>"
    $environment = (Get-Content -Raw -Path "packages/cdk/cdk.json" | ConvertFrom-Json).context.env
}
else {
    Write-Host "Using environment: $environment"
}

Write-Host "Using AWS profile: $profile"

$STACK_NAME = "GenerativeAiUseCasesStack$environment"
Write-Host "Using stack output for $STACK_NAME"

function Extract-Value {
    param (
        [string]$stackOutputJson,
        [string]$key
    )
    return ($stackOutputJson | ConvertFrom-Json).Stacks[0].Outputs | 
        Where-Object { $_.OutputKey -eq $key } | 
        Select-Object -ExpandProperty OutputValue
}

# Add the profile parameter to the AWS CLI command
$stack_output = aws cloudformation describe-stacks --stack-name $STACK_NAME --profile $profile --output json

if ($null -eq $stack_output) {
    Write-Host "No stack output found for stack: $STACK_NAME. Please check the environment (-env) and profile (-profile) parameters."
    exit 1
}

$env:VITE_APP_VERSION= (Get-Content -Raw -Path ".\package.json" | ConvertFrom-Json).version
$env:VITE_APP_API_ENDPOINT = Extract-Value $stack_output "ApiEndpoint"
$env:VITE_APP_REGION = Extract-Value $stack_output "Region"
$env:VITE_APP_USER_POOL_ID = Extract-Value $stack_output "UserPoolId"
$env:VITE_APP_USER_POOL_CLIENT_ID = Extract-Value $stack_output "UserPoolClientId"
$env:VITE_APP_IDENTITY_POOL_ID = Extract-Value $stack_output "IdPoolId"
$env:VITE_APP_PREDICT_STREAM_FUNCTION_ARN = Extract-Value $stack_output "PredictStreamFunctionArn"
$env:VITE_APP_FLOW_STREAM_FUNCTION_ARN = Extract-Value $stack_output "InvokeFlowFunctionArn"
$env:VITE_APP_FLOWS = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($(Extract-Value $stack_output "Flows")))
$env:VITE_APP_RAG_ENABLED = Extract-Value $stack_output "RagEnabled"
$env:VITE_APP_RAG_KNOWLEDGE_BASE_ENABLED = Extract-Value $stack_output "RagKnowledgeBaseEnabled"
$env:VITE_APP_AGENT_ENABLED = Extract-Value $stack_output "AgentEnabled"
$env:VITE_APP_SELF_SIGN_UP_ENABLED = Extract-Value $stack_output "SelfSignUpEnabled"
$env:VITE_APP_MODEL_REGION = Extract-Value $stack_output "ModelRegion"
$env:VITE_APP_MODEL_IDS = Extract-Value $stack_output "ModelIds"
$env:VITE_APP_IMAGE_MODEL_IDS = Extract-Value $stack_output "ImageGenerateModelIds"
$env:VITE_APP_VIDEO_MODEL_IDS = Extract-Value $stack_output "VideoGenerateModelIds"
$env:VITE_APP_ENDPOINT_NAMES = Extract-Value $stack_output "EndpointNames"
$env:VITE_APP_SAMLAUTH_ENABLED = Extract-Value $stack_output "SamlAuthEnabled"
$env:VITE_APP_SAML_COGNITO_DOMAIN_NAME = Extract-Value $stack_output "SamlCognitoDomainName"
$env:VITE_APP_SAML_COGNITO_FEDERATED_IDENTITY_PROVIDER_NAME = Extract-Value $stack_output "SamlCognitoFederatedIdentityProviderName"
$env:VITE_APP_AGENT_NAMES = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($(Extract-Value $stack_output "AgentNames")))
$env:VITE_APP_INLINE_AGENTS = Extract-Value $stack_output "InlineAgents"
$env:VITE_APP_USE_CASE_BUILDER_ENABLED = Extract-Value $stack_output "UseCaseBuilderEnabled"
$env:VITE_APP_OPTIMIZE_PROMPT_FUNCTION_ARN = Extract-Value $stack_output "OptimizePromptFunctionArn"
$env:VITE_APP_HIDDEN_USE_CASES = Extract-Value $stack_output "HiddenUseCases"
$env:VITE_APP_SPEECH_TO_SPEECH_NAMESPACE = Extract-Value $stack_output "SpeechToSpeechNamespace"
$env:VITE_APP_SPEECH_TO_SPEECH_EVENT_API_ENDPOINT = Extract-Value $stack_output "SpeechToSpeechEventApiEndpoint"
$env:VITE_APP_SPEECH_TO_SPEECH_MODEL_IDS = Extract-Value $stack_output "SpeechToSpeechModelIds"

npm -w packages/web run dev
