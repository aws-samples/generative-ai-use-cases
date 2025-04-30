# (DEPRECATED) Deployment Method Entirely on AWS (For Cases Where Setting Up a Local Environment is Difficult)

> [!Caution]
> This procedure has been deprecated as AWS Cloud9 has closed access to new customers.
> For deployment methods that can be completed entirely on AWS, please refer to [Deployment Method Using CloudShell](./DEPLOY_ON_CLOUDSHELL.md).
> For migration from AWS Cloud9, please refer to [this blog](https://aws.amazon.com/jp/blogs/news/how-to-migrate-from-aws-cloud9-to-aws-ide-toolkits-or-aws-cloudshell/).

By using AWS CloudShell and AWS Cloud9, you can deploy without depending on your local environment. (Deployment is completed entirely on AWS.)

## Creating a Cloud9 Environment

We will use [cloud9-setup-for-prototyping](https://github.com/aws-samples/cloud9-setup-for-prototyping). The environment created with cloud9-setup-for-prototyping addresses common issues such as memory and storage shortages and insufficient permissions, which differ from the default Cloud9 environment. Open [AWS CloudShell](https://console.aws.amazon.com/cloudshell/home) and follow the instructions in [cloud9-setup-for-prototyping's README.md](https://github.com/aws-samples/cloud9-setup-for-prototyping) to create a Cloud9 environment. Below are just the commands to execute. Please check the README.md for details.

```bash
git clone https://github.com/aws-samples/cloud9-setup-for-prototyping
cd cloud9-setup-for-prototyping
./bin/bootstrap
```

Once creation is complete, you will see an environment called cloud9-for-prototyping in [AWS Cloud9](https://console.aws.amazon.com/cloud9control/home). Click Open to launch the IDE.
All of the following steps will be performed in the created IDE.

## Deploying generative-ai-use-cases

Execute the following commands in the Terminal at the bottom of the IDE. This will clone generative-ai-use-cases and move to the working directory.

```bash
git clone https://github.com/aws-samples/generative-ai-use-cases
cd generative-ai-use-cases/
```

Then follow the instructions in [generative-ai-use-cases's README.md](/README.md#デプロイ). Below are just the commands to execute.

```bash
npm ci
npx -w packages/cdk cdk bootstrap # Only if needed for CDK Bootstrap (can be executed multiple times without issues)
npm run cdk:deploy
```

## Changing Deployment Options

Open `cloud9-for-prototyping/generative-ai-use-cases/packages/cdk/cdk.json` and modify the items in the context. For configurable options, please refer to [here](./DEPLOY_OPTION.md).

After changing the contents of cdk.json, save the file and run `npm run cdk:deploy`. The configuration changes will be applied upon deployment.

## Frontend Development

To use Cloud9's Preview feature, you need to listen on ports 8080 to 8082 on localhost. ([Reference](https://docs.aws.amazon.com/ja_jp/cloud9/latest/user-guide/app-preview.html)) [Vite](https://ja.vitejs.dev/), which is used for frontend development in generative-ai-use-cases, uses port 5173 by default, so we need to change this.

Open `cloud9-for-prototyping/generative-ai-use-cases/packages/web/package.json` and change the dev command in scripts from `vite` to `vite --port 8080`. After the change, part of package.json will look like this. (Note that you can also set the port in vite.config.ts, but we won't cover that here.)

```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 8080",
  ... omitted
```

Save the file after making the changes. Next, install `jq` which is used internally by subsequent commands.

```bash
sudo yum -y install jq
```

Then follow the instructions [here](./DEVELOPMENT.md). Execute the following command:

```bash
npm run web:devw
```

After execution, click Preview at the top of the IDE and then click Preview Running Application. This will display a browser within the IDE. When you change the frontend code, the changes will be applied to the screen in real-time. There is a "open in new window" icon button in the top right of the browser within the IDE. By clicking it, you can open the Preview in a separate browser tab. After opening it in a separate tab, you can close the browser within the IDE.
