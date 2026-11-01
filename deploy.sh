#!/bin/bash

set -e

# Set Node.js memory limit to 1.5GB (1536MB)
export NODE_OPTIONS="--max-old-space-size=1536"

echo "--------------------------"
echo "  _____            _    _ "
echo " / ____|          | |  | |"
echo "| |  __  ___ _ __ | |  | |"
echo "| | |_ |/ _ \ '_ \| |  | |"
echo "| |__| |  __/ | | | |__| |"
echo " \_____|\___|_| |_|\____/ "
echo "--------------------------"

# Process command arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -c|--cdk-context)
            cdk_context_path="$2"
            shift 2
            ;;
        -p|--parameter-file)
            parameter_file_path="$2"
            shift 2
            ;;
        -e|--env)
            env_name="$2"
            shift 2
            ;;
        -r|--ref)
            git_ref="$2"
            shift 2
            ;;
        -h|--help)
            echo "-c, --cdk-context    ... Path to the cdk.json file"
            echo "-p, --parameter-file ... Path to the parameter.ts file"
            echo "-e, --env           ... Environment name (e.g., dev, prod)"
            echo "-r, --ref           ... Git tag or branch to deploy (default: the latest release)"
            echo "-h, --help          ... Show this message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if the file exists
if [[ -n "$cdk_context_path" && ! -f "$cdk_context_path" ]]; then
    echo "Error: CDK context file not found: $cdk_context_path"
    exit 1
fi

if [[ -n "$parameter_file_path" && ! -f "$parameter_file_path" ]]; then
    echo "Error: Parameter file not found: $parameter_file_path"
    exit 1
fi

pushd /tmp

# Delete the repository in /tmp if it exists
rm -rf generative-ai-use-cases

# Clone GenU
git clone https://github.com/aws-samples/generative-ai-use-cases

pushd generative-ai-use-cases

# Deploy the latest release unless a tag or branch is specified.
# The main branch can contain changes that are not released yet.
if [[ -z "$git_ref" ]]; then
    git_ref=$(curl -fsSL https://api.github.com/repos/aws-samples/generative-ai-use-cases/releases/latest | jq -r '.tag_name // empty' || true)
fi
if [[ -z "$git_ref" ]]; then
    git_ref=$(git describe --tags --abbrev=0)
fi
echo "Deploy GenU $git_ref"
git -c advice.detachedHead=false checkout "$git_ref"

# Install npm packages
npm ci

# If cdk.json is specified, overwrite it
if [[ -n "$cdk_context_path" ]]; then
    echo "Overwrite the cdk.json by $cdk_context_path"
    cp -f $cdk_context_path packages/cdk/cdk.json
fi


# If parameter.ts is specified, overwrite it
if [[ -n "$parameter_file_path" ]]; then
    echo "Overwrite the parameter.ts by $parameter_file_path"
    cp -f $parameter_file_path packages/cdk/parameter.ts
fi

# Bootstrap CDK
npx -w packages/cdk cdk bootstrap

# Build deployment command
deploy_cmd="npm run cdk:deploy:quick"

# If environment name is specified, add it to the deployment command
if [[ -n "$env_name" ]]; then
    deploy_cmd="$deploy_cmd -- -c env=$env_name"
fi

# Execute deployment
$deploy_cmd

# Get the url of the deployed CloudFront
weburl=`aws cloudformation describe-stacks --stack-name GenerativeAiUseCasesStack$env_name --output json | jq -r ".Stacks[0].Outputs[] | select(.OutputKey==\"WebUrl\") | .OutputValue"`

echo "*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*"
echo "Welcome to GenU: $weburl"
echo "*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*-*"
