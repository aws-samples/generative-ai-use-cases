# Deployment Method Using AWS CloudShell (When Preparing a Local Environment is Difficult)

## How to Set Deployment Options

In GenU, you can specify deployment options in the following two ways:

1. Specifying in the context of cdk.json
2. Specifying in parameter.ts (Recommended for new builds as it allows defining settings for multiple environments)

Please refer to [Deployment Options](./DEPLOY_OPTION.md) for available deployment options.

### Setting in cdk.json

Download the [default cdk.json](/packages/cdk/cdk.json) (you can download the file from the download button at the top right of the GitHub page) and modify the context section, then save the file.

### Setting in parameter.ts

Download the [default parameter.ts](/packages/cdk/parameter.ts) and add the necessary environment settings. In parameter.ts, you can manage multiple environment settings like dev, staging, prod in a single file.

## Launching CloudShell

Launch [CloudShell](https://console.aws.amazon.com/cloudshell/home).
If you have customized cdk.json or parameter.ts, upload the customized files from Upload file in the Actions menu at the top right.

## Downloading deploy.sh and Granting Execution Permissions

Execute the following commands in CloudShell to download the `deploy.sh` script.
After downloading, grant execution permissions to deploy.sh.

```bash
wget https://raw.githubusercontent.com/aws-samples/generative-ai-use-cases/refs/heads/main/deploy.sh -O deploy.sh
chmod +x deploy.sh
```

## Executing deploy.sh

deploy.sh supports the following options:

```bash
-c, --cdk-context    ... Path to the cdk.json file
-p, --parameter-file ... Path to the parameter.ts file
-e, --env           ... Environment name (e.g., dev, prod)
-h, --help          ... Show this message
```

### Deployment Examples

Execute deploy.sh with the following commands. Note that the --cdk-context option specifies the path to the customized cdk.json. (For --parameter-file, it's the path to parameter.ts) If you uploaded files without any modifications as described earlier, this path will be used. If cdk.json or parameter.ts is in a different path, modify the argument value accordingly.

1. Deploy with default settings:

```bash
./deploy.sh
```

2. Deploy using a customized cdk.json:

```bash
./deploy.sh --cdk-context ~/cdk.json
```

3. Deploy an unnamed environment using a customized parameter.ts:

```bash
./deploy.sh --parameter-file ~/parameter.ts
```

4. Deploy specifying parameter.ts and environment:

```bash
./deploy.sh --parameter-file ~/parameter.ts --env prod
```

When deployment is complete, the CloudFront URL will be displayed. You can access GenU by opening that URL in a browser.

### Configuration Priority

1. If parameter.ts and environment are specified, and the environment name (including unnamed environments) is defined in parameter.ts, those settings have the highest priority
2. cdk.json settings are applied next

Note that to execute these steps, you also need to enable the models from [Amazon Bedrock Model access](https://console.aws.amazon.com/bedrock/home#/modelaccess).
Confirm that the models specified in modelIds, imageGenerationModelIds, videoGenerationModelIds, and speechToSpeechModelIds in the modelRegion of the configuration file (parameter.ts or cdk.json) are enabled.
