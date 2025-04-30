# Browser Extension Build Instructions

## Prerequisites

Node.js installation is required for building. If you haven't installed it yet, please prepare using one of the following methods:

- Install Node.js on your local PC
  - Download and install the version marked as "LTS" from [here](https://nodejs.org/en/download).
- Use AWS Cloud9 environment
  - Create a Cloud9 environment by following [these instructions](./DEPLOY_ON_AWS.md#creating-a-cloud9-environment).

## Build

Once prerequisites are ready, follow these steps to build.

The following steps must be executed in the root folder of `generative-ai-use-cases`. Please note that you should not run them in `generative-ai-use-cases/browser-extension`.

### For users with Unix commands (Cloud9, Linux, macOS, etc.)

Run the following commands to dynamically retrieve necessary environment variables from CloudFormation Output and build with the appropriate settings.
Note that these commands use the `aws` and `jq` commands internally, so please install them if they're not already installed.

```bash
npm run extension:ci
npm run extension:buildw
```

The build artifacts will be stored in `browser-extension/dist/`.

### For other users (Windows, etc.)

You can check the values needed for configuration by clicking on GenerativeAiUseCasesStack in [CloudFormation](https://console.aws.amazon.com/cloudformation/home) and opening the outputs tab.

You need to set these values as environment variables using one of the following methods:

#### Method 1: Export shell variables

Set the values as shell variables and export them to use as environment variables with the following commands. Windows users using PowerShell should refer to [this documentation](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables) as the commands differ.

```bash
export VITE_APP_API_ENDPOINT=<API Endpoint>
export VITE_APP_REGION=<Deployed Region>
export VITE_APP_USER_POOL_ID=<Cognito User Pool ID>
export VITE_APP_USER_POOL_CLIENT_ID=<Cognito User Pool Client ID>
export VITE_APP_IDENTITY_POOL_ID=<Cognito Identity Pool ID>
export VITE_APP_PREDICT_STREAM_FUNCTION_ARN=<Function ARN>
```

Here's a concrete example:

```bash
export VITE_APP_API_ENDPOINT=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/api/
export VITE_APP_REGION=ap-northeast-1
export VITE_APP_USER_POOL_ID=ap-northeast-1_xxxxxxxxx
export VITE_APP_USER_POOL_CLIENT_ID=abcdefghijklmnopqrstuvwxyz
export VITE_APP_IDENTITY_POOL_ID=ap-northeast-1:xxxxxxxx-xxxx-xxxx-xxxxxxxxxxxxxxxxx
export VITE_APP_PREDICT_STREAM_FUNCTION_ARN=arn:aws:lambda:ap-northeast-1:000000000000:function:FunctionName
```

#### Method 2: Use a `.env` file

The frontend uses Vite for building, which can use a `.env` file to set environment variables (see [reference](https://vitejs.dev/guide/env-and-mode#env-files)). Create a `/browser-extension/.env` file and set the same items as in the "Export shell variables" method above. Note that you should not include the `export` keyword.

```bash
VITE_APP_API_ENDPOINT=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/api/
VITE_APP_REGION=ap-northeast-1
### Remaining items omitted ###
```

#### Running the build

Once the environment variables are set, run the following commands:

```bash
npm run extension:ci
npm run extension:build
```

The build artifacts will be stored in `browser-extension/dist/`.

## Distribution Method

Compress the build artifact folder `browser-extension/dist/` using zip or similar.
Distribute the compressed file using your preferred method.
